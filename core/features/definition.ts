/**
 * Go-to-definition (순수).
 *
 * 커서가 ref 지시어의 값(예: `track_script chk` 의 chk) 위면,
 * 그 심볼을 defines 하는 정의의 위치를 찾아 돌려준다.
 * include 다중파일은 어댑터가 심볼 테이블을 병합해 넘길 수 있다.
 *
 * VSCode 의존 없음 (ADR-0002).
 *
 * 설계 근거: docs/01-architecture/03-validation.md §5 (참조 무결성)
 */

import { parse } from "../parser/index.js";
import type { ConfFile, Range } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";
import { getSchema } from "../schema/load.js";
import { collectSymbols, type SymbolTable } from "../validation/symbols.js";
import { normalizeAliases, walkBlocks } from "../validation/walk.js";

export interface DefinitionResult {
  /** 정의 위치. 같은 파일 기준 range. */
  range: Range;
  /** 심볼 집합 이름 (예: vrrp_scripts). */
  set: string;
  /** 심볼 이름. */
  name: string;
}

/**
 * 커서 위치의 ref 값에 대한 정의를 찾는다.
 * 못 찾으면 null. symbols 미제공 시 같은 파일에서 수집.
 */
export function definitionAt(
  text: string,
  line: number,
  col: number,
  schema: SchemaIndex = getSchema(),
  symbols?: SymbolTable
): DefinitionResult | null {
  const ast = normalizeAliases(parse(text).ast, schema);
  const hit = refAt(ast, schema, line, col);
  if (!hit) return null;

  const table = symbols ?? collectSymbols(ast, schema);
  const entry = (table[hit.set] ?? []).find((e) => e.name === hit.name);
  if (!entry) return null;
  return { range: entry.range, set: hit.set, name: hit.name };
}

/** 커서가 어떤 ref 지시어의 값 토큰 위인지 판정. */
function refAt(
  file: ConfFile,
  schema: SchemaIndex,
  line: number,
  col: number
): { set: string; name: string } | null {
  let found: { set: string; name: string } | null = null;
  walkBlocks(file, ({ block }) => {
    if (found) return;
    for (const child of block.body) {
      if (child.type !== "directive") continue;
      const dspec = schema.directive(block.keyword, child.keyword);
      if (!dspec || dspec.type !== "ref" || !dspec.refTo) continue;
      for (const v of child.values) {
        if (inRange(line, col, v.range)) {
          found = { set: dspec.refTo, name: v.text };
          return;
        }
      }
    }
  });
  return found;
}

function inRange(line: number, col: number, r: Range): boolean {
  if (line < r.start.line || line > r.end.line) return false;
  if (line === r.start.line && col < r.start.col) return false;
  if (line === r.end.line && col > r.end.col) return false;
  return true;
}
