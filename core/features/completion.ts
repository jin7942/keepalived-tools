/**
 * Completion 후보 생성 (순수).
 *
 * 커서 컨텍스트(부모 블록 + 현재 줄)로 후보를 만든다:
 *  - 줄이 `<directive> ` 형태면 그 지시어의 enum 허용값.
 *  - 그 외엔 현재 블록에서 가능한 지시어 + 자식 블록.
 *
 * vscode 어댑터가 CompletionItem 으로 변환.
 *
 * 설계 근거: docs/01-architecture/01-schema.md §1 (Completion)
 */

import { parse } from "../parser/index.js";
import type { SchemaIndex } from "../schema/index.js";
import { getSchema } from "../schema/load.js";
import { locate } from "./locate.js";

export type CompletionKind = "block" | "directive" | "enum" | "value";

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  /** 블록 스니펫 등 삽입 텍스트(미지정 시 label). */
  insertText?: string;
  /** insertText 가 스니펫 문법인가. */
  isSnippet?: boolean;
}

export function completeAt(
  text: string,
  line: number,
  col: number,
  schema: SchemaIndex = getSchema()
): CompletionItem[] {
  const { ast } = parse(text);
  const ctx = locate(ast, line, col);
  const parent = ctx.parentBlock;

  // 현재 줄 앞부분으로 enum 값 완성 여부 판정.
  const lineText = nthLine(text, line).slice(0, col);
  const enumItems = enumCandidates(lineText, parent, schema);
  if (enumItems.length) return enumItems;

  return memberCandidates(parent, schema);
}

/** 줄 앞부분이 `<directive> [partial]` 형태면 그 지시어의 enum 값 후보. */
function enumCandidates(
  linePrefix: string,
  parent: string | null,
  schema: SchemaIndex
): CompletionItem[] {
  if (!parent) return [];
  const m = linePrefix.match(/^\s*([A-Za-z_][\w]*)\s+\S*$/);
  if (!m) return [];
  const directive = m[1];
  const spec = schema.directive(parent, directive);
  if (!spec || spec.type !== "enum" || !spec.values) return [];
  return spec.values.map((v) => ({ label: v, kind: "enum" as const, detail: `${directive} value` }));
}

/** 현재 블록에서 가능한 지시어 + 자식 블록. */
function memberCandidates(parent: string | null, schema: SchemaIndex): CompletionItem[] {
  const items: CompletionItem[] = [];

  if (parent === null) {
    // 최상위: root 블록들.
    for (const name of schema.blockNames()) {
      if (schema.isRoot(name)) {
        items.push(blockItem(name, schema));
      }
    }
    return items;
  }

  // 블록 안: 지시어 + 자식 블록.
  for (const name of schema.directiveNames(parent)) {
    const spec = schema.directive(parent, name);
    items.push({
      label: name,
      kind: "directive",
      detail: spec?.type ? `${spec.type}${spec.aliasOf ? ` (alias)` : ""}` : undefined,
    });
  }
  for (const sub of schema.subBlocks(parent)) {
    items.push(blockItem(sub, schema));
  }
  return items;
}

function blockItem(name: string, schema: SchemaIndex): CompletionItem {
  const spec = schema.block(name);
  return {
    label: name,
    kind: "block",
    detail: spec?.description,
    insertText: `${name} {\n\t$0\n}`,
    isSnippet: true,
  };
}

function nthLine(text: string, line: number): string {
  return text.split("\n")[line] ?? "";
}
