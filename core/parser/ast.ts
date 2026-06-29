/**
 * keepalived.conf AST 노드 정의.
 *
 * 모든 노드는 위치(Range)를 갖는다 — 진단을 정확한 줄/칸에 찍기 위함.
 * VSCode 의존 없음 (ADR-0002).
 *
 * 설계 근거: docs/01-architecture/02-parser.md §5
 */

export interface Position {
  /** 0-based 줄 번호. */
  line: number;
  /** 0-based 칸(문자) 번호. */
  col: number;
  /** 파일 시작부터의 0-based 문자 오프셋. */
  offset: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Node {
  range: Range;
}

/** 값 노드의 lexer 수준 종류 추정. 정밀 타입 판정은 검증 타입층. */
export type ValueKind = "word" | "quoted" | "number" | "ip" | "var" | "seq";

export interface Value extends Node {
  /** 원본 문자열 (인용부호 제거 전 raw). */
  raw: string;
  /** quoted 의 경우 인용부호를 벗긴 내용. 그 외엔 raw 와 동일. */
  text: string;
  kind: ValueKind;
}

/** `include <glob>` 지시어. */
export interface IncludeDirective extends Node {
  type: "include";
  glob: string;
}

/** `keyword value...` 단일 지시어. */
export interface Directive extends Node {
  type: "directive";
  keyword: string;
  values: Value[];
  /** @ 조건부 접두사 (예: "high", "^main"). 없으면 무조건. */
  condition?: string;
}

/** 중첩(`{ }`)을 여는 블록. */
export interface Block extends Node {
  type: "block";
  keyword: string;
  /** 블록 헤더 인자: `vrrp_instance VI_1 {` 의 VI_1. */
  args: Value[];
  /** 자식: 블록·지시어를 원본 순서 보존해 하나의 배열로 (포맷터·completion 용). */
  body: BlockChild[];
  condition?: string;
}

export type BlockChild = Block | Directive | IncludeDirective;

export interface ConfFile extends Node {
  /** 최상위에는 블록·지시어·include 가 모두 올 수 있음. */
  body: BlockChild[];
}

/** 파서가 복구하며 수집한 구문 오류. 검증 구문층에서 Diagnostic 으로 변환. */
export interface ParseError {
  range: Range;
  message: string;
  /** 진단 코드 (검증층 코드 체계와 일치). */
  code: string;
}

export interface ParseResult {
  ast: ConfFile;
  errors: ParseError[];
}
