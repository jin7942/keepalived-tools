/**
 * 층 4: include 다중파일 검증 (include.ts).
 *
 * core 는 fs 를 직접 안 건드린다(ADR-0002). 어댑터가 glob 을 해석해
 * 파일 텍스트 배열 + 각 파일의 resolve 된 include 경로를 넘긴다.
 *
 * 처리: 전체 파일의 심볼을 병합 → 각 파일을 병합 심볼로 의미 재검증
 *       (크로스파일 참조 해소). include 그래프로 순환 감지.
 *
 * 설계 근거: docs/01-architecture/03-validation.md §6, ADR-0010
 */

import { parse } from "../parser/index.js";
import type { ConfFile, ParseError, Range } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";
import { type Diagnostic, diag } from "./diagnostic.js";
import { normalizeAliases } from "./walk.js";
import { validateSyntax } from "./syntax.js";
import { validateTypes } from "./type.js";
import { validateSemantics } from "./semantic.js";
import { collectSymbols, type SymbolTable } from "./symbols.js";

export interface SourceFile {
  path: string;
  text: string;
  /**
   * 이 파일의 include 가 가리키는, 어댑터가 resolve 한 실제 파일 경로들.
   * 순환 감지·NOT_FOUND 판정에 사용. 미제공 시 순환 감지 생략.
   */
  resolvedIncludes?: string[];
}

interface Parsed {
  path: string;
  ast: ConfFile;
  errors: ParseError[];
}

export interface IncludeOptions {
  reportUnused?: boolean;
  reportMissingRequired?: boolean;
}

export function validateInclude(
  files: SourceFile[],
  entryPath: string,
  schema: SchemaIndex,
  options: IncludeOptions = {}
): Map<string, Diagnostic[]> {
  const reportUnused = options.reportUnused === true;
  const result = new Map<string, Diagnostic[]>();
  const byPath = new Map<string, SourceFile>();
  for (const f of files) byPath.set(f.path, f);

  // 1) 전 파일 파싱 + alias 정규화.
  const parsed: Parsed[] = files.map((f) => {
    const { ast, errors } = parse(f.text);
    return { path: f.path, ast: normalizeAliases(ast, schema), errors };
  });

  // 2) 전역 병합 심볼 테이블.
  const merged: SymbolTable = {};
  for (const p of parsed) collectSymbols(p.ast, schema, merged);

  // 3) 각 파일 검증 (의미층은 병합 심볼로).
  for (const p of parsed) {
    const diags: Diagnostic[] = [];
    diags.push(...validateSyntax(p.ast, p.errors, schema));
    diags.push(...validateTypes(p.ast, schema));
    const sem = validateSemantics(p.ast, schema, {
      symbols: merged,
      reportMissingRequired: options.reportMissingRequired === true,
    });
    diags.push(...(reportUnused ? sem : sem.filter((d) => d.code !== "SEMANTIC_UNUSED")));
    result.set(p.path, diags);
  }

  // 4) include 그래프 검사 (순환 + NOT_FOUND).
  checkIncludeGraph(files, byPath, entryPath, result);

  return result;
}

function checkIncludeGraph(
  files: SourceFile[],
  byPath: Map<string, SourceFile>,
  entryPath: string,
  result: Map<string, Diagnostic[]>
): void {
  const hasResolveInfo = files.some((f) => f.resolvedIncludes !== undefined);
  if (!hasResolveInfo) return;

  // NOT_FOUND: resolve 됐으나 제공 파일 목록에 없는 경로.
  for (const f of files) {
    for (const inc of f.resolvedIncludes ?? []) {
      if (!byPath.has(inc)) {
        pushTo(result, f.path, diag(zeroRange(), "warning", "INCLUDE_NOT_FOUND", `Included file not found: ${inc}`));
      }
    }
  }

  // 순환 감지: entry 부터 DFS.
  const visiting = new Set<string>();
  const done = new Set<string>();
  const cycleFrom = (path: string): boolean => {
    if (visiting.has(path)) return true;
    if (done.has(path)) return false;
    visiting.add(path);
    const f = byPath.get(path);
    for (const inc of f?.resolvedIncludes ?? []) {
      if (cycleFrom(inc)) {
        pushTo(result, path, diag(zeroRange(), "error", "INCLUDE_CYCLE", `Circular include detected at: ${inc}`));
        visiting.delete(path);
        done.add(path);
        return true;
      }
    }
    visiting.delete(path);
    done.add(path);
    return false;
  };
  if (byPath.has(entryPath)) cycleFrom(entryPath);
}

function pushTo(map: Map<string, Diagnostic[]>, key: string, d: Diagnostic): void {
  (map.get(key) ?? map.set(key, []).get(key)!).push(d);
}

function zeroRange(): Range {
  const p = { line: 0, col: 0, offset: 0 };
  return { start: p, end: p };
}
