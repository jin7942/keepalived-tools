/**
 * 층 2: 타입 검증 (type.ts).
 *
 * 스키마 type/min/max/values 로 지시어 값과 블록 헤더 인자를 검사.
 * $VAR/~SEQ/@조건부 값은 검증 면제 (값을 모르므로, §4 규칙).
 *
 * 설계 근거: docs/01-architecture/03-validation.md §4
 */

import type { ConfFile, Value } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";
import type { DirectiveSpec } from "../schema/types.js";
import { type Diagnostic, diag } from "./diagnostic.js";
import { checkValue } from "./type-checkers.js";
import { walkBlocks, walkDirectives } from "./walk.js";

/** $VAR/~SEQ 가 섞인 값은 타입 검사 면제. */
function isExempt(v: Value): boolean {
  return v.kind === "var" || v.kind === "seq";
}

export function validateTypes(file: ConfFile, schema: SchemaIndex): Diagnostic[] {
  const out: Diagnostic[] = [];

  // 지시어 값 검사.
  walkDirectives(file, ({ directive, parent }) => {
    if (parent === null) return;
    const spec = schema.directive(parent, directive.keyword);
    if (!spec || !spec.type) return;
    // @조건부 줄도 값 자체는 검사 가능하나, 면제 대상이 섞이면 스킵.
    checkDirectiveValues(directive.values, spec, out);
  });

  // 블록 헤더 인자 검사 (real_server IP/port 등).
  walkBlocks(file, ({ block }) => {
    const spec = schema.block(block.keyword);
    const argSpecs = spec?.args;
    if (!argSpecs) return;
    // 대체 헤더 형태(fwmark/group 등): 기본 args 타입검사 면제.
    if (spec?.argKeywords && block.args.length > 0 && spec.argKeywords.includes(block.args[0].text)) {
      return;
    }
    for (let idx = 0; idx < argSpecs.length && idx < block.args.length; idx++) {
      const argSpec = argSpecs[idx];
      const v = block.args[idx];
      if (isExempt(v)) continue;
      const err = checkValue(argSpec.type, v.text, { type: argSpec.type, values: argSpec.values });
      if (err) {
        out.push(diag(v.range, "error", err.code, `${argSpec.name}: ${err.message}`));
      }
    }
  });

  return out;
}

function checkDirectiveValues(values: Value[], spec: DirectiveSpec, out: Diagnostic[]): void {
  // 단일 값 지시어가 대부분. 첫 값만 타입 검사(나머지는 의미별로 다양 → 보수적).
  if (values.length === 0) return;
  const v = values[0];
  if (isExempt(v)) return;
  if (!spec.type) return;
  const err = checkValue(spec.type, v.text, spec);
  if (err) {
    out.push(diag(v.range, "error", err.code, err.message));
  }
}
