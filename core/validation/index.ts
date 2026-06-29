/**
 * core/validation 오케스트레이터.
 *
 * AST + 스키마 → Diagnostic[]. alias 정규화 1회 후 4층 순차 적용.
 * 단일 파일 진입점 `validate`, 다중 파일(include) 진입점 `validateFiles`.
 *
 * 설계 근거: docs/01-architecture/03-validation.md §2, §6
 */

import { parse } from "../parser/index.js";
import type { ConfFile, ParseError } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";
import { getSchema } from "../schema/load.js";
import type { Diagnostic } from "./diagnostic.js";
import { normalizeAliases } from "./walk.js";
import { validateSyntax } from "./syntax.js";
import { validateTypes } from "./type.js";
import { validateSemantics } from "./semantic.js";
import { collectSymbols, type SymbolTable } from "./symbols.js";
import { validateInclude, type SourceFile } from "./include.js";

export * from "./diagnostic.js";
export type { SourceFile } from "./include.js";

export interface ValidateOptions {
  schema?: SchemaIndex;
  /** 미참조(SEMANTIC_UNUSED) 진단 활성화. 기본 false (ADR-0009: 시드 단계 오탐 방지). */
  reportUnused?: boolean;
  /** 필수 지시어 누락 진단 활성화. 기본 false (ADR-0011: 편집 중 오탐 방지). */
  reportMissingRequired?: boolean;
}

/** 단일 파일 검증 (텍스트 in → 진단 out). */
export function validateText(text: string, options: ValidateOptions = {}): Diagnostic[] {
  const schema = options.schema ?? getSchema();
  const { ast, errors } = parse(text);
  return validateAst(ast, errors, schema, undefined, options);
}

/** 파싱된 AST 검증 (심볼 테이블 주입 가능 — include 병합용). */
export function validateAst(
  rawAst: ConfFile,
  parseErrors: ParseError[],
  schema: SchemaIndex,
  symbols: SymbolTable | undefined,
  options: ValidateOptions = {}
): Diagnostic[] {
  const ast = normalizeAliases(rawAst, schema);
  const out: Diagnostic[] = [];

  out.push(...validateSyntax(ast, parseErrors, schema));
  out.push(...validateTypes(ast, schema));

  const sem = validateSemantics(ast, schema, {
    symbols: symbols ?? collectSymbols(ast, schema),
    reportMissingRequired: options.reportMissingRequired === true,
  });
  out.push(...filterUnused(sem, options.reportUnused === true));

  return sortByPosition(out);
}

/**
 * 다중 파일 검증 (include).
 * 어댑터가 glob 을 해석해 파일 텍스트 배열을 넘긴다 (core 는 fs 비의존).
 */
export function validateFiles(
  files: SourceFile[],
  entryPath: string,
  options: ValidateOptions = {}
): Map<string, Diagnostic[]> {
  const schema = options.schema ?? getSchema();
  return validateInclude(files, entryPath, schema, options.reportUnused === true);
}

function filterUnused(diags: Diagnostic[], reportUnused: boolean): Diagnostic[] {
  if (reportUnused) return diags;
  return diags.filter((d) => d.code !== "SEMANTIC_UNUSED");
}

function sortByPosition(diags: Diagnostic[]): Diagnostic[] {
  return [...diags].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) return a.range.start.line - b.range.start.line;
    return a.range.start.col - b.range.start.col;
  });
}
