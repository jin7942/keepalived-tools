/**
 * 심볼 테이블 구축.
 *
 * AST(+include 병합분)를 훑어 `defines` 로 등록되는 이름을 수집한다.
 * 의미층(ref 검사)·include 층이 공유. 여러 파일을 합쳐 만들 수 있게 분리.
 *
 * 설계 근거: docs/01-architecture/03-validation.md §5.1
 */

import type { ConfFile, Range } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";
import { walkBlocks } from "./walk.js";

export interface SymbolEntry {
  name: string;
  range: Range;
}

/** key = 심볼 집합 이름(예: vrrp_scripts), value = 정의 목록. */
export type SymbolTable = Record<string, SymbolEntry[]>;

/** 단일 AST 에서 심볼을 수집해 테이블에 누적한다. */
export function collectSymbols(file: ConfFile, schema: SchemaIndex, into: SymbolTable = {}): SymbolTable {
  walkBlocks(file, ({ block }) => {
    const spec = schema.block(block.keyword);
    const argSpecs = spec?.args;
    if (!argSpecs) return;
    for (let i = 0; i < argSpecs.length && i < block.args.length; i++) {
      const argSpec = argSpecs[i];
      if (!argSpec.defines) continue;
      const v = block.args[i];
      (into[argSpec.defines] ??= []).push({ name: v.text, range: v.range });
    }
  });
  return into;
}

/** 심볼 집합에 이름이 존재하는가. */
export function hasSymbol(table: SymbolTable, set: string, name: string): boolean {
  return (table[set] ?? []).some((e) => e.name === name);
}
