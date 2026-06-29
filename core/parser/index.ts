/**
 * core/parser 공개 진입점.
 * 설계 근거: docs/01-architecture/02-parser.md
 */

export * from "./ast.js";
export { tokenize } from "./lexer.js";
export type { Token, TokenType } from "./lexer.js";
export { parse } from "./parser.js";
export { classifyWord, tokenToValue } from "./value.js";
