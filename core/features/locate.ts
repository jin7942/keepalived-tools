/**
 * 위치(line, col) → AST 컨텍스트 해석.
 *
 * hover·completion 이 "커서가 어느 블록 안의 어느 키워드 위인가"를 알아야 한다.
 * VSCode 의존 없음.
 *
 * 설계 근거: docs/01-architecture/00-overview.md §5 (core 순수 인터페이스)
 */

import type { Block, BlockChild, ConfFile, Position, Range } from "../parser/ast.js";

export interface LocationContext {
  /** 커서를 감싸는 가장 안쪽 블록의 canonical 이름. 최상위면 null. */
  parentBlock: string | null;
  /** 커서가 키워드 토큰 위면 그 키워드. */
  keyword?: string;
  /** 키워드가 블록인지 지시어인지. */
  keywordKind?: "block" | "directive";
  /** 커서 위 키워드의 range (hover 하이라이트용). */
  keywordRange?: Range;
}

function inRange(pos: { line: number; col: number }, range: Range): boolean {
  const { start, end } = range;
  if (pos.line < start.line || pos.line > end.line) return false;
  if (pos.line === start.line && pos.col < start.col) return false;
  if (pos.line === end.line && pos.col > end.col) return false;
  return true;
}

/** 블록 헤더(keyword) 영역 = 블록 시작부터 첫 자식/본문 전까지의 첫 줄. */
function blockKeywordRange(block: Block): Range {
  const start = block.range.start;
  // 헤더는 보통 한 줄. keyword 길이만큼.
  const end: Position = {
    line: start.line,
    col: start.col + block.keyword.length,
    offset: start.offset + block.keyword.length,
  };
  return { start, end };
}

/**
 * 주어진 위치의 컨텍스트를 찾는다.
 * parentBlock: 커서를 포함하는 가장 안쪽 블록.
 * keyword: 커서가 키워드 토큰 위면 채워짐.
 */
export function locate(file: ConfFile, line: number, col: number): LocationContext {
  const pos = { line, col };
  let result: LocationContext = { parentBlock: null };

  const recur = (children: BlockChild[], currentParent: string | null) => {
    for (const c of children) {
      if (c.type === "block") {
        // 헤더 키워드 위?
        const kwRange = blockKeywordRange(c);
        if (inRange(pos, kwRange)) {
          result = {
            parentBlock: currentParent,
            keyword: c.keyword,
            keywordKind: "block",
            keywordRange: kwRange,
          };
          return true;
        }
        // 블록 본문 안?
        if (inRange(pos, c.range)) {
          result = { parentBlock: c.keyword };
          if (recur(c.body, c.keyword)) return true;
          // 본문 안이지만 특정 자식 위는 아님 → parentBlock 만 유지.
          return true;
        }
      } else if (c.type === "directive") {
        const start = c.range.start;
        const kwEnd: Position = {
          line: start.line,
          col: start.col + c.keyword.length,
          offset: start.offset + c.keyword.length,
        };
        const kwRange = { start, end: kwEnd };
        if (inRange(pos, kwRange)) {
          result = {
            parentBlock: currentParent,
            keyword: c.keyword,
            keywordKind: "directive",
            keywordRange: kwRange,
          };
          return true;
        }
      }
    }
    return false;
  };

  recur(file.body, null);
  return result;
}
