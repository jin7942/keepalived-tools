/**
 * Hover 데이터 생성 (순수).
 *
 * 위치의 키워드 → 스키마 설명/타입/범위/허용값 마크다운.
 * vscode 어댑터가 이 마크다운을 vscode.Hover 로 감싼다.
 *
 * 설계 근거: docs/01-architecture/01-schema.md §1 (Hover), 03-validation.md §1
 */

import { parse } from "../parser/index.js";
import type { Range } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";
import { getSchema } from "../schema/load.js";
import type { BlockSpec, DirectiveSpec } from "../schema/types.js";
import { locate } from "./locate.js";

export interface HoverResult {
  markdown: string;
  range?: Range;
}

export function hoverAt(
  text: string,
  line: number,
  col: number,
  schema: SchemaIndex = getSchema()
): HoverResult | null {
  const { ast } = parse(text);
  const ctx = locate(ast, line, col);
  if (!ctx.keyword) return null;

  if (ctx.keywordKind === "block") {
    const spec = schema.block(ctx.keyword);
    if (!spec) return null;
    return { markdown: blockHover(ctx.keyword, spec), range: ctx.keywordRange };
  }

  // 지시어.
  if (ctx.parentBlock) {
    const spec = schema.directive(ctx.parentBlock, ctx.keyword);
    if (spec) {
      const canonical = schema.canonicalDirective(ctx.parentBlock, ctx.keyword);
      return { markdown: directiveHover(ctx.keyword, canonical, spec), range: ctx.keywordRange };
    }
  }
  return null;
}

/** keepalived.conf(5) man 페이지 — hover footer 공통. */
const MAN_URL = "https://www.keepalived.org/manpage.html";

function blockHover(name: string, spec: BlockSpec): string {
  const lines: string[] = [`**${name}** _(block)_`];
  if (spec.deprecated) lines.push("\n⚠️ _deprecated_");
  if (spec.aliasOf) lines.push(`\n_alias of_ \`${spec.aliasOf}\``);
  if (spec.conditional) lines.push(`\n🔧 _requires build option_ \`${spec.conditional}\``);
  if (spec.description) lines.push(`\n${spec.description}`);
  if (spec.subBlocks?.length) lines.push(`\n**children:** ${spec.subBlocks.join(", ")}`);
  if (spec.srcRef) lines.push(`\n\`source: ${spec.srcRef}\``);
  lines.push(`\n[keepalived.conf(5)](${MAN_URL})`);
  return lines.join("\n");
}

function directiveHover(name: string, canonical: string, spec: DirectiveSpec): string {
  const lines: string[] = [`**${name}**${spec.type ? ` _(${spec.type})_` : ""}`];
  if (canonical !== name) lines.push(`\n_alias of_ \`${canonical}\``);
  if (spec.deprecated) lines.push("\n⚠️ _deprecated_");
  if (spec.conditional) lines.push(`\n🔧 _requires build option_ \`${spec.conditional}\``);
  if (spec.description) lines.push(`\n${spec.description}`);

  const meta: string[] = [];
  if (spec.min !== undefined || spec.max !== undefined) {
    meta.push(`range: ${spec.min ?? "−∞"}..${spec.max ?? "∞"}`);
  }
  if (spec.values?.length) {
    meta.push(`values: ${spec.values.join(" | ")}${spec.caseInsensitive ? " _(case-insensitive)_" : ""}`);
  }
  if (spec.refTo) meta.push(`references: ${spec.refTo}`);
  if (spec.default !== undefined) meta.push(`default: ${spec.default}`);
  if (spec.required) meta.push("required");
  if (meta.length) lines.push(`\n${meta.map((m) => `- ${m}`).join("\n")}`);

  if (spec.srcRef) lines.push(`\n\`source: ${spec.srcRef}\``);
  lines.push(`\n[keepalived.conf(5)](${MAN_URL})`);
  return lines.join("\n");
}
