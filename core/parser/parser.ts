/**
 * keepalived.conf 재귀 하강 파서.
 *
 * 토큰 스트림 → AST. 검증은 안 한다(구조화만, SRP).
 * 편집 중 불완전 파일에서도 최대한 AST 를 만든다(오류 복구, 파서 §6).
 *
 * 블록 판정: 지시어 라인 끝(또는 헤더 인자 뒤)에 `{` 가 오면 블록.
 * keepalived 는 줄 기반이지만 `{`/`}` 는 같은 줄·다음 줄 모두 허용한다.
 *
 * 설계 근거: docs/01-architecture/02-parser.md §2, §4, §6
 */

import type { Token } from "./lexer.js";
import { tokenize } from "./lexer.js";
import { tokenToValue } from "./value.js";
import type {
  Block,
  BlockChild,
  ConfFile,
  Directive,
  IncludeDirective,
  ParseError,
  ParseResult,
  Position,
  Range,
  Value,
} from "./ast.js";

export function parse(text: string): ParseResult {
  const tokens = tokenize(text);
  return new Parser(tokens).parseFile();
}

class Parser {
  private i = 0;
  private readonly errors: ParseError[] = [];

  constructor(private readonly tokens: Token[]) {}

  parseFile(): ParseResult {
    // 파일은 항상 0:0 에서 시작(주석/공백 전용 파일도 일관).
    const start: Position = { line: 0, col: 0, offset: 0 };
    const body = this.parseChildren(null);
    const end = this.prevEnd();
    const ast: ConfFile = { range: { start, end }, body };
    return { ast, errors: this.errors };
  }

  /** 현재 위치부터 자식들을 파싱. parentBraceOpen 이 있으면 RBRACE 에서 멈춘다. */
  private parseChildren(parentBraceStart: Position | null): BlockChild[] {
    const body: BlockChild[] = [];
    while (!this.isEof()) {
      this.skipNewlines();
      if (this.isEof()) break;

      const t = this.peek();
      if (t.type === "RBRACE") {
        if (parentBraceStart !== null) {
          // 호출자(블록)가 닫을 것.
          return body;
        }
        // 최상위에서 짝 없는 } → 오류 수집 후 스킵.
        this.error(this.rangeOf(t), "Unexpected '}'", "SYNTAX_UNBALANCED_BRACE");
        this.next();
        continue;
      }

      const child = this.parseStatement();
      if (child) body.push(child);
    }
    if (parentBraceStart !== null) {
      // EOF 인데 블록이 안 닫힘.
      this.error(
        { start: parentBraceStart, end: parentBraceStart },
        "Unclosed block: missing '}'",
        "SYNTAX_UNBALANCED_BRACE"
      );
    }
    return body;
  }

  /** 한 문장(지시어/블록/include) 파싱. */
  private parseStatement(): BlockChild | null {
    let condition: string | undefined;
    const first = this.peek();

    // 줄 맨 앞 @조건부 접두사.
    if (first.type === "WORD" && first.value.startsWith("@")) {
      condition = first.value.slice(1); // "@high" → "high", "@^main" → "^main"
      this.next();
    }

    const head = this.peek();
    if (head.type !== "WORD" && head.type !== "STRING") {
      if (head.type === "LBRACE") {
        // 키워드 없는 { → 오류.
        this.error(this.rangeOf(head), "Block without keyword", "SYNTAX_INCOMPLETE");
        this.next();
        return null;
      }
      // NEWLINE/EOF 등: 빈 문장.
      this.next();
      return null;
    }

    const keyword = head.value;
    const headStart = head.start;
    this.next();

    // include 처리.
    if (keyword === "include") {
      return this.finishInclude(headStart);
    }

    // 헤더 토큰들(값/인자) 수집: NEWLINE | LBRACE | RBRACE | EOF 까지.
    const headerValues: Value[] = [];
    while (true) {
      const t = this.peek();
      if (t.type === "NEWLINE" || t.type === "EOF" || t.type === "LBRACE" || t.type === "RBRACE") {
        break;
      }
      headerValues.push(tokenToValue(t));
      this.next();
    }

    let after = this.peek();
    // `{` 가 다음 줄에 오는 경우도 블록으로 인정 (keepalived 허용).
    // 헤더 뒤 NEWLINE 만 있고 그 다음 비빈 토큰이 LBRACE 면 블록.
    if (after.type === "NEWLINE" && this.lookaheadBraceAcrossNewlines()) {
      this.skipNewlines();
      after = this.peek();
    }
    if (after.type === "LBRACE") {
      return this.finishBlock(keyword, headStart, headerValues, condition);
    }

    // 지시어.
    const lastEnd = headerValues.length > 0 ? headerValues[headerValues.length - 1].range.end : after.start;
    const dir: Directive = {
      type: "directive",
      keyword,
      values: headerValues,
      range: { start: headStart, end: lastEnd },
    };
    if (condition !== undefined) dir.condition = condition;
    return dir;
  }

  private finishInclude(headStart: Position): IncludeDirective {
    // include 뒤 첫 토큰 = glob.
    const t = this.peek();
    let glob = "";
    let end = headStart;
    if (t.type === "WORD" || t.type === "STRING") {
      glob = t.value;
      end = t.end;
      this.next();
    } else {
      this.error({ start: headStart, end: headStart }, "include: missing path/glob", "SYNTAX_INCOMPLETE");
    }
    // 나머지 토큰은 줄 끝까지 무시.
    while (!this.isLineEnd()) this.next();
    return { type: "include", glob, range: { start: headStart, end } };
  }

  private finishBlock(
    keyword: string,
    headStart: Position,
    args: Value[],
    condition: string | undefined
  ): Block {
    const brace = this.peek();
    this.next(); // consume LBRACE
    const body = this.parseChildren(brace.start);
    let end = this.prevEnd();
    // 닫는 } 소비.
    if (this.peek().type === "RBRACE") {
      end = this.peek().end;
      this.next();
    }
    const block: Block = {
      type: "block",
      keyword,
      args,
      body,
      range: { start: headStart, end },
    };
    if (condition !== undefined) block.condition = condition;
    return block;
  }

  // ---- 토큰 커서 헬퍼 ----

  private peek(): Token {
    return this.tokens[this.i] ?? this.tokens[this.tokens.length - 1];
  }

  private next(): Token {
    const t = this.peek();
    if (this.i < this.tokens.length - 1) this.i++;
    return t;
  }

  private isEof(): boolean {
    return this.peek().type === "EOF";
  }

  private isLineEnd(): boolean {
    const t = this.peek().type;
    return t === "NEWLINE" || t === "EOF";
  }

  private skipNewlines(): void {
    while (this.peek().type === "NEWLINE") this.next();
  }

  /**
   * 현재 위치(NEWLINE)에서 연속된 NEWLINE 만 건너뛴 직후 토큰이 LBRACE 인지 미리보기.
   * 커서는 이동하지 않는다. 헤더와 `{` 가 줄바꿈으로 분리된 경우를 잡는다.
   */
  private lookaheadBraceAcrossNewlines(): boolean {
    let j = this.i;
    while (this.tokens[j]?.type === "NEWLINE") j++;
    return this.tokens[j]?.type === "LBRACE";
  }

  private prevEnd(): Position {
    const idx = this.i > 0 ? this.i - 1 : 0;
    return this.tokens[idx]?.end ?? { line: 0, col: 0, offset: 0 };
  }

  private rangeOf(t: Token): Range {
    return { start: t.start, end: t.end };
  }

  private error(range: Range, message: string, code: string): void {
    this.errors.push({ range, message, code });
  }
}
