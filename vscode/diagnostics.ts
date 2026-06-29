/**
 * 진단 어댑터: 편집/저장 시 core 검증 → DiagnosticCollection.
 *
 * debounce 는 어댑터 레벨(validation §7). include 가 있으면 다중 파일,
 * 없으면 단일 파일 검증. glob resolve 는 어댑터 책임(ADR-0010).
 */

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { validateText, validateFiles, type Diagnostic, type SourceFile } from "../core/validation/index.js";
import { parse } from "../core/parser/index.js";
import { toVsRange, toVsSeverity } from "./convert.js";

const DEBOUNCE_MS = 300;
const LANGUAGE_ID = "keepalived";

/** 사용자 설정을 core ValidateOptions 로 변환. */
function readOptions(doc: vscode.TextDocument): {
  enable: boolean;
  maxFileSize: number;
  reportUnused: boolean;
  reportMissingRequired: boolean;
} {
  const cfg = vscode.workspace.getConfiguration("keepalived.validation", doc.uri);
  return {
    enable: cfg.get<boolean>("enable", true),
    maxFileSize: cfg.get<number>("maxFileSize", 1048576),
    reportUnused: cfg.get<boolean>("reportUnused", false),
    reportMissingRequired: cfg.get<boolean>("reportMissingRequired", false),
  };
}

export function registerDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("keepalived");
  context.subscriptions.push(collection);

  const timers = new Map<string, NodeJS.Timeout>();

  const schedule = (doc: vscode.TextDocument) => {
    if (doc.languageId !== LANGUAGE_ID) return;
    const key = doc.uri.toString();
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void runValidation(doc, collection);
      }, DEBOUNCE_MS)
    );
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidOpenTextDocument((doc) => schedule(doc)),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
    // 설정 변경 시 열린 문서 전부 재검증.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("keepalived")) return;
      for (const doc of vscode.workspace.textDocuments) schedule(doc);
    })
  );

  // 이미 열린 문서.
  for (const doc of vscode.workspace.textDocuments) schedule(doc);
}

async function runValidation(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): Promise<void> {
  // 한 문서의 예외가 기능 전체를 깨뜨리지 않도록 격리.
  try {
    const opts = readOptions(doc);
    if (!opts.enable) {
      collection.delete(doc.uri);
      return;
    }

    const text = doc.getText();
    // 대용량 파일 가드: 매 타이핑 전체 재파싱이 에디터를 지연시키지 않도록.
    if (opts.maxFileSize > 0 && Buffer.byteLength(text, "utf8") > opts.maxFileSize) {
      collection.delete(doc.uri);
      return;
    }

    const coreOpts = {
      reportUnused: opts.reportUnused,
      reportMissingRequired: opts.reportMissingRequired,
    };
    const includes = collectIncludeGlobs(text);

    if (includes.length === 0) {
      publish(collection, doc.uri, validateText(text, coreOpts));
      return;
    }

    // 다중 파일: include 를 resolve 해 텍스트 수집.
    const entryPath = doc.uri.fsPath;
    const files = await gatherFiles(entryPath, text);
    const resultMap = validateFiles(files, entryPath, coreOpts);
    // 진입 문서 진단만 현재 문서에 표시(다른 파일은 열릴 때 각자 검증).
    publish(collection, doc.uri, resultMap.get(entryPath) ?? []);
  } catch (err) {
    // 진단 실패는 조용히 무시(stale 방지 위해 비움). 콘솔에만 기록.
    console.error("keepalived: validation failed", err);
    collection.delete(doc.uri);
  }
}

function collectIncludeGlobs(text: string): string[] {
  const { ast } = parse(text);
  return ast.body.filter((n) => n.type === "include").map((n) => (n as { glob: string }).glob);
}

/**
 * entry 부터 include 를 따라가며 파일 텍스트를 수집.
 * 깊이 제한·중복 방지. glob 은 디렉토리 내 단순 매칭으로 resolve.
 */
async function gatherFiles(entryPath: string, entryText: string): Promise<SourceFile[]> {
  const seen = new Map<string, SourceFile>();
  const queue: { p: string; text: string }[] = [{ p: entryPath, text: entryText }];

  while (queue.length) {
    const { p, text } = queue.shift()!;
    if (seen.has(p)) continue;
    const resolved = await resolveIncludes(p, text);
    seen.set(p, { path: p, text, resolvedIncludes: resolved });
    for (const inc of resolved) {
      if (!seen.has(inc)) {
        try {
          const t = await fs.readFile(inc, "utf8");
          queue.push({ p: inc, text: t });
        } catch {
          // 못 읽는 파일은 core 가 NOT_FOUND 로 처리.
        }
      }
    }
  }
  return [...seen.values()];
}

async function resolveIncludes(filePath: string, text: string): Promise<string[]> {
  const baseDir = path.dirname(filePath);
  const { ast } = parse(text);
  const out: string[] = [];
  for (const node of ast.body) {
    if (node.type !== "include") continue;
    const glob = (node as { glob: string }).glob;
    const abs = path.isAbsolute(glob) ? glob : path.join(baseDir, glob);
    out.push(...(await expandGlob(abs)));
  }
  return out;
}

/**
 * glob 확장. 지원: `dir/*.conf`(단일 디렉토리), `dir/** /*.conf`(재귀).
 * glob 문자 없으면 경로 그대로. keepalived 의 흔한 include 패턴을 커버한다.
 */
async function expandGlob(pattern: string): Promise<string[]> {
  if (!pattern.includes("*")) return [pattern];

  if (pattern.includes("**")) {
    // 재귀: ** 이전을 루트, 이후 basename 패턴으로 매칭.
    const idx = pattern.indexOf("**");
    const root = path.dirname(pattern.slice(0, idx)) || pattern.slice(0, idx) || "/";
    const base = path.basename(pattern);
    const re = globToRegExp(base);
    return walkDir(root, re);
  }

  const dir = path.dirname(pattern);
  const re = globToRegExp(path.basename(pattern));
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((e) => re.test(e)).map((e) => path.join(dir, e));
  } catch {
    return [];
  }
}

function globToRegExp(base: string): RegExp {
  return new RegExp("^" + base.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

/** 디렉토리를 재귀 워크하며 basename 이 re 에 맞는 파일 수집(깊이 제한). */
async function walkDir(root: string, re: RegExp, depth = 0): Promise<string[]> {
  if (depth > 16) return []; // 폭주 방지.
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkDir(full, re, depth + 1)));
    } else if (re.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function publish(
  collection: vscode.DiagnosticCollection,
  uri: vscode.Uri,
  diags: Diagnostic[]
): void {
  const vsDiags = diags.map((d) => {
    const vd = new vscode.Diagnostic(toVsRange(d.range), d.message, toVsSeverity(d.severity));
    vd.code = d.code;
    vd.source = "keepalived";
    if (d.related) {
      vd.relatedInformation = d.related.map(
        (r) =>
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(uri, toVsRange(r.range)),
            r.message
          )
      );
    }
    return vd;
  });
  collection.set(uri, vsDiags);
}
