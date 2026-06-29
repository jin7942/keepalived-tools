/**
 * Quick-fix 후보 생성 (순수).
 *
 * 진단 코드별로 "did you mean ...?" 교정 후보를 만든다.
 * 신뢰성 우선: 편집거리 임계 내 근접 후보만(오타 한두 글자) 제안.
 * 멀리 떨어진 후보를 들이밀면 오히려 잡음 → 제안하지 않는다.
 *
 * VSCode 어댑터가 CodeAction 으로 변환.
 *
 * 설계 근거: docs/01-architecture/03-validation.md §1.1 (신뢰성 우선)
 */

import { parse } from "../parser/index.js";
import type { SchemaIndex } from "../schema/index.js";
import { getSchema } from "../schema/load.js";
import { locate } from "./locate.js";

/** 교정 후보 1건. */
export interface Suggestion {
  /** 교체할 텍스트. */
  replacement: string;
}

/**
 * 진단(코드+위치)에 대한 교정 후보를 만든다.
 * @param code     진단 코드 (예: TYPE_INVALID_ENUM, SYNTAX_UNKNOWN_DIRECTIVE)
 * @param badText  잘못된 토큰 텍스트 (교정 대상)
 * @param line,col 토큰 위치 (컨텍스트 해석용)
 */
export function quickFixesFor(
  text: string,
  code: string,
  badText: string,
  line: number,
  col: number,
  schema: SchemaIndex = getSchema()
): Suggestion[] {
  const candidates = candidatesFor(text, code, line, col, schema);
  return nearest(badText, candidates).map((replacement) => ({ replacement }));
}

/** 진단 코드별 교정 후보 풀. */
function candidatesFor(
  text: string,
  code: string,
  line: number,
  col: number,
  schema: SchemaIndex
): string[] {
  const ctx = locate(parse(text).ast, line, col);
  const parent = ctx.parentBlock;

  switch (code) {
    case "TYPE_INVALID_ENUM": {
      // enum 진단 위치는 값 토큰 → locate.keyword 가 비어있다.
      // 줄 첫 토큰(지시어명)을 직접 뽑아 그 enum 값 목록을 후보로.
      if (!parent) return [];
      const directive = firstToken(nthLine(text, line));
      if (!directive) return [];
      const spec = schema.directive(parent, directive);
      return spec?.values ?? [];
    }
    case "SYNTAX_UNKNOWN_DIRECTIVE": {
      if (parent === null) {
        return schema.blockNames().filter((n) => schema.isRoot(n));
      }
      return [...schema.directiveNames(parent), ...schema.subBlocks(parent)];
    }
    default:
      return [];
  }
}

function nthLine(text: string, line: number): string {
  return text.split("\n")[line] ?? "";
}

/** 줄의 첫 단어 토큰(지시어/블록 키워드). 없으면 null. */
function firstToken(lineText: string): string | null {
  const m = lineText.match(/^\s*([A-Za-z_][\w]*)/);
  return m ? m[1] : null;
}

/**
 * badText 와 편집거리가 가까운 후보만 골라 거리순 정렬.
 * 임계: 길이의 1/3 이하이고 최대 3 (오타 수준만).
 */
function nearest(badText: string, candidates: string[]): string[] {
  const limit = Math.min(3, Math.max(1, Math.floor(badText.length / 3)));
  return candidates
    .map((c) => ({ c, d: levenshtein(badText.toLowerCase(), c.toLowerCase()) }))
    .filter((x) => x.d > 0 && x.d <= limit)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((x) => x.c);
}

/** 표준 편집거리 (Wagner-Fischer). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
