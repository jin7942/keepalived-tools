/**
 * 문서 아웃라인 (순수).
 *
 * AST 의 블록 트리를 심볼 트리로 변환한다. 어댑터가 DocumentSymbol 로 매핑해
 * 아웃라인·브레드크럼·Ctrl+Shift+O 에 사용. 지시어는 노이즈라 블록만 노출한다.
 *
 * VSCode 의존 없음 (ADR-0002).
 */

import { parse } from "../parser/index.js";
import type { Block, BlockChild, Range } from "../parser/ast.js";

export type SymbolKind = "block" | "object";

export interface DocSymbol {
  /** 표시 이름 (블록 키워드). */
  name: string;
  /** 헤더 인자 요약 (예: "VI_1", "10.0.0.1 80"). 없으면 빈 문자열. */
  detail: string;
  kind: SymbolKind;
  /** 블록 전체 범위 (접기·선택용). */
  range: Range;
  /** 이름 토큰 범위 (점프 대상). */
  selectionRange: Range;
  children: DocSymbol[];
}

/** 텍스트 → 심볼 트리. 블록만, 원본 순서 보존. */
export function outline(text: string): DocSymbol[] {
  const { ast } = parse(text);
  return collect(ast.body);
}

function collect(children: BlockChild[]): DocSymbol[] {
  const out: DocSymbol[] = [];
  for (const c of children) {
    if (c.type !== "block") continue;
    out.push(toSymbol(c));
  }
  return out;
}

function toSymbol(block: Block): DocSymbol {
  return {
    name: block.keyword,
    detail: block.args.map((a) => a.text).join(" "),
    kind: "block",
    range: block.range,
    selectionRange: headerRange(block),
    children: collect(block.body),
  };
}

/** 블록 헤더 키워드 토큰 범위 (블록 시작부터 keyword 길이만큼). */
function headerRange(block: Block): Range {
  const start = block.range.start;
  return {
    start,
    end: {
      line: start.line,
      col: start.col + block.keyword.length,
      offset: start.offset + block.keyword.length,
    },
  };
}
