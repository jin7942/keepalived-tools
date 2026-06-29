/**
 * 층 1: 구문 검증 (syntax.ts).
 *
 * 구조 정합성: 괄호 짝(ParseError 승계), 미지시어, 잘못된 부모 블록, 종류 오용.
 *
 * 신뢰성 우선(§1.1): 스키마 커버리지가 부분적이므로, 부모 블록이 스키마에 정의돼
 * 있을 때만 그 자식의 미지시어를 판정한다. 부모가 스키마 밖이면 침묵(오탐 방지).
 *
 * 설계 근거: docs/01-architecture/03-validation.md §3, ADR-0009
 */

import type { ConfFile, ParseError } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";
import { type Diagnostic, diag } from "./diagnostic.js";
import { walkBlocks, walkDirectives } from "./walk.js";

export function validateSyntax(
  file: ConfFile,
  parseErrors: ParseError[],
  schema: SchemaIndex
): Diagnostic[] {
  const out: Diagnostic[] = [];

  // ParseError (괄호 등) 승계.
  for (const e of parseErrors) {
    out.push(diag(e.range, "error", e.code, e.message));
  }

  // 블록 검사.
  walkBlocks(file, ({ block, parent }) => {
    if (block.condition !== undefined) {
      // @조건부 줄도 정상 파싱은 하되, 구조 판정은 정상 키워드와 동일하게 진행.
    }
    const known = schema.hasBlock(block.keyword);

    if (!known) {
      // 미지블록 단정은 부모가 complete(자식 목록 완전)일 때만 (ADR-0009).
      // 시드 스키마는 부분적이므로 기본 침묵 → 정상 블록 오탐 방지.
      if (parent !== null && schema.block(parent)?.complete) {
        out.push(
          diag(
            headerRange(block),
            "error",
            "SYNTAX_UNKNOWN_DIRECTIVE",
            `Unknown block '${block.keyword}'`
          )
        );
      }
      return;
    }

    // 알려진 블록 → 부모 적합성 검사.
    if (!schema.isValidChild(block.keyword, parent)) {
      const where = parent === null ? "top level" : `'${parent}'`;
      out.push(
        diag(
          headerRange(block),
          "error",
          "SYNTAX_INVALID_PARENT",
          `Block '${block.keyword}' is not allowed in ${where}`
        )
      );
    }

    // 종류 오용: 스키마상 지시어인데 블록(`{`)으로 쓴 경우.
    // (블록 스키마가 있으므로 여기선 정상. directive 오용은 아래 지시어 검사에서.)
  });

  // 지시어 검사.
  walkDirectives(file, ({ directive, parent }) => {
    // 최상위 단발 지시어(global one-liners)는 스키마 커버리지 밖일 수 있음 → 침묵.
    if (parent === null) return;
    if (!schema.hasBlock(parent)) return; // 부모 미커버 → 침묵.

    const block = schema.block(parent);
    if (block?.freeform) return; // 자유형 블록 본문은 검사 스킵.
    const dirSpec = schema.directive(parent, directive.keyword);

    if (!dirSpec) {
      // 부모 블록이 자식 블록으로 이 keyword 를 허용하면 종류 오용(블록을 `{` 없이 씀).
      // 단, 그 자식이 freeform 이면 인라인 형태도 허용될 수 있어 단정 회피.
      if (block?.subBlocks?.includes(directive.keyword) && !schema.block(directive.keyword)?.freeform) {
        out.push(
          diag(
            directive.range,
            "error",
            "SYNTAX_WRONG_KIND",
            `'${directive.keyword}' is a block and requires '{ }'`
          )
        );
        return;
      }
      // 미지시어 단정은 부모가 complete 일 때만 (ADR-0009).
      if (block?.complete) {
        out.push(
          diag(
            directive.range,
            "error",
            "SYNTAX_UNKNOWN_DIRECTIVE",
            `Unknown directive '${directive.keyword}' in '${parent}'`
          )
        );
      }
    }
  });

  return out;
}

/** 블록 헤더(keyword + args) 영역. 본문 전까지. */
function headerRange(block: { range: { start: import("../parser/ast.js").Position; end: import("../parser/ast.js").Position }; args: { range: { end: import("../parser/ast.js").Position } }[] }) {
  const start = block.range.start;
  const end = block.args.length > 0 ? block.args[block.args.length - 1].range.end : block.range.end;
  return { start, end };
}
