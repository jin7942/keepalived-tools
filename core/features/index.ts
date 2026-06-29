/**
 * core/features 공개 진입점 (hover/completion/format).
 * 모두 순수 — vscode 어댑터가 호출해 UI 객체로 변환.
 */

export { hoverAt, type HoverResult } from "./hover.js";
export { completeAt, type CompletionItem, type CompletionKind } from "./completion.js";
export { format, type FormatOptions } from "./format.js";
export { locate, type LocationContext } from "./locate.js";
export { definitionAt, type DefinitionResult } from "./definition.js";
export { quickFixesFor, type Suggestion } from "./quickfix.js";
export { outline, type DocSymbol } from "./outline.js";
