/**
 * 토큰 → Value 노드 분류.
 *
 * lexer 수준 추정만 한다(kind). 정밀 타입 판정(범위·enum 등)은 검증 타입층.
 * `$VAR`/`~SEQ()` 는 검증 면제 대상이므로 여기서 식별해 둔다(파서 §4.2/§4.3).
 */

import type { Token } from "./lexer.js";
import type { Value, ValueKind } from "./ast.js";

/** IPv4/IPv6 대략 판별 (정밀 검증은 타입층 inet_pton 모방). */
function looksLikeIp(s: string): boolean {
  // CIDR suffix 제거 후 판별.
  const base = s.split("/")[0];
  // IPv4: 점 3개 + 숫자.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(base)) return true;
  // IPv6: 콜론 포함 + 16진수/콜론으로만 구성.
  if (base.includes(":") && /^[0-9a-fA-F:]+$/.test(base)) return true;
  return false;
}

function looksLikeNumber(s: string): boolean {
  return /^[+-]?\d+(\.\d+)?$/.test(s);
}

/** WORD 의 내용으로 ValueKind 추정. */
export function classifyWord(word: string): ValueKind {
  if (word.includes("$")) return "var";
  if (word.includes("~SEQ(") || word.includes("~SEQ ")) return "seq";
  if (looksLikeIp(word)) return "ip";
  if (looksLikeNumber(word)) return "number";
  return "word";
}

/** Token 을 Value 노드로 변환. */
export function tokenToValue(tok: Token): Value {
  const range = { start: tok.start, end: tok.end };
  if (tok.type === "STRING") {
    return { range, raw: tok.raw, text: tok.value, kind: "quoted" };
  }
  return { range, raw: tok.raw, text: tok.value, kind: classifyWord(tok.value) };
}
