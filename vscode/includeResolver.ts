/**
 * include glob resolve (어댑터 책임, ADR-0010).
 *
 * core 는 fs 비의존이라 어댑터가 glob 을 실제 파일 경로로 푼다.
 * 진단 다중파일 수집과 DocumentLink(클릭 이동)가 공유한다.
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";

const MAX_WALK_DEPTH = 16; // 심링크 순환·폭주 방지.

/** glob 을 baseDir 기준 절대경로로 만들고 확장. glob 문자 없으면 단일 경로. */
export async function resolveGlob(baseDir: string, glob: string): Promise<string[]> {
  const abs = path.isAbsolute(glob) ? glob : path.join(baseDir, glob);
  return expandGlob(abs);
}

/**
 * glob 확장. 지원: `dir/*.conf`(단일), `dir/** /*.conf`(재귀).
 * keepalived 의 흔한 include 패턴을 커버한다.
 */
export async function expandGlob(pattern: string): Promise<string[]> {
  if (!pattern.includes("*")) return [pattern];

  if (pattern.includes("**")) {
    const idx = pattern.indexOf("**");
    const root = path.dirname(pattern.slice(0, idx)) || pattern.slice(0, idx) || "/";
    const re = globToRegExp(path.basename(pattern));
    return walkDir(root, re);
  }

  const dir = path.dirname(pattern);
  const re = globToRegExp(path.basename(pattern));
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((e) => re.test(e))
      .map((e) => path.join(dir, e))
      .sort();
  } catch {
    return [];
  }
}

function globToRegExp(base: string): RegExp {
  return new RegExp("^" + base.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

/** 디렉토리 재귀 워크. basename 이 re 에 맞는 파일 수집(깊이 제한). */
async function walkDir(root: string, re: RegExp, depth = 0): Promise<string[]> {
  if (depth > MAX_WALK_DEPTH) return [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(root, e.name);
    // 일반 디렉토리만 따라간다(심링크 디렉토리는 순환 위험 → 건너뜀).
    if (e.isDirectory()) {
      out.push(...(await walkDir(full, re, depth + 1)));
    } else if ((e.isFile() || e.isSymbolicLink()) && re.test(e.name)) {
      out.push(full);
    }
  }
  return out.sort();
}
