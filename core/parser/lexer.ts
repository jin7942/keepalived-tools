/**
 * keepalived.conf Lexer (토큰화).
 *
 * keepalived 는 줄(line) 기반 파싱 → NEWLINE 을 토큰으로 보존한다.
 * 주석은 `#` 와 `!` 둘 다 (줄 끝까지). quoted 안의 특수문자는 리터럴.
 *
 * `@`(조건부)·`$`(변수)·`~SEQ`(시퀀스)는 WORD 로 토큰화하고,
 * 의미 분류는 파서/값 분류 단계에서 컨텍스트(줄 위치 등)와 함께 판정한다.
 *
 * 설계 근거: docs/01-architecture/02-parser.md §3, §4
 */

import type { Position } from "./ast.js";

export type TokenType =
  | "WORD" // 지시어·값 공통 (비인용)
  | "STRING" // "quoted"
  | "LBRACE" // {
  | "RBRACE" // }
  | "NEWLINE" // 줄 구분
  | "EOF";

export interface Token {
  type: TokenType;
  /** 원본 텍스트 (STRING 은 인용부호 포함). */
  raw: string;
  /** STRING 의 경우 인용부호를 벗긴 값. 그 외엔 raw 와 동일. */
  value: string;
  start: Position;
  end: Position;
}

export function tokenize(text: string): Token[] {
  return new Lexer(text).run();
}

class Lexer {
  private pos = 0;
  private line = 0;
  private col = 0;
  private readonly tokens: Token[] = [];

  constructor(private readonly src: string) {}

  run(): Token[] {
    // 선두 UTF-8 BOM(U+FEFF) 스킵 — Windows 파일에서 첫 키워드 오염 방지.
    if (this.src.charCodeAt(0) === 0xfeff) this.advance();

    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];

      if (ch === "\n") {
        this.pushNewline();
        this.advanceNewline();
        continue;
      }
      if (ch === "\r") {
        // CRLF: \r 는 무시하고 \n 에서 NEWLINE 처리.
        this.advance();
        continue;
      }
      if (ch === " " || ch === "\t") {
        this.advance();
        continue;
      }
      if (ch === "#" || ch === "!") {
        this.skipLineComment();
        continue;
      }
      if (ch === "{") {
        this.pushSingle("LBRACE", "{");
        this.advance();
        continue;
      }
      if (ch === "}") {
        this.pushSingle("RBRACE", "}");
        this.advance();
        continue;
      }
      if (ch === '"') {
        this.readString();
        continue;
      }
      this.readWord();
    }
    this.pushSingle("EOF", "");
    return this.tokens;
  }

  private posObj(): Position {
    return { line: this.line, col: this.col, offset: this.pos };
  }

  private advance(): void {
    this.pos++;
    this.col++;
  }

  private advanceNewline(): void {
    this.pos++;
    this.line++;
    this.col = 0;
  }

  private pushSingle(type: TokenType, raw: string): void {
    const start = this.posObj();
    const end: Position = { line: this.line, col: this.col + raw.length, offset: this.pos + raw.length };
    this.tokens.push({ type, raw, value: raw, start, end });
  }

  /** NEWLINE 은 end 가 다음 줄 col 0 (개행은 줄을 넘긴다). */
  private pushNewline(): void {
    const start = this.posObj();
    const end: Position = { line: this.line + 1, col: 0, offset: this.pos + 1 };
    this.tokens.push({ type: "NEWLINE", raw: "\n", value: "\n", start, end });
  }

  private skipLineComment(): void {
    while (this.pos < this.src.length && this.src[this.pos] !== "\n") {
      this.advance();
    }
  }

  private readString(): void {
    const start = this.posObj();
    let raw = '"';
    this.advance(); // opening quote
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (ch === "\n") break; // unterminated — 줄 끝에서 종료
      raw += ch;
      this.advance();
      if (ch === '"') break; // closing quote
    }
    const end = this.posObj();
    const closed = raw.length >= 2 && raw.endsWith('"');
    const value = closed ? raw.slice(1, -1) : raw.slice(1);
    this.tokens.push({ type: "STRING", raw, value, start, end });
  }

  private readWord(): void {
    const start = this.posObj();
    let raw = "";
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (
        ch === " " ||
        ch === "\t" ||
        ch === "\n" ||
        ch === "\r" ||
        ch === "{" ||
        ch === "}" ||
        ch === '"'
      ) {
        break;
      }
      // 인라인 주석 시작: 공백 없이 붙은 # 도 keepalived 는 주석으로 보지 않으나
      // 안전하게 word 경계로만 처리(주석은 줄 단위 스캔에서 별도). 여기선 word 에 포함.
      raw += ch;
      this.advance();
    }
    const end = this.posObj();
    this.tokens.push({ type: "WORD", raw, value: raw, start, end });
  }
}
