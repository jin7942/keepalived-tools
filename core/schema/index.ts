/**
 * 스키마 로더 + 조회 헬퍼.
 *
 * merged.json 을 읽어 Schema 객체로 제공하고, alias 정규화·블록/지시어 조회를 돕는다.
 * VSCode 의존 없음 (ADR-0002).
 *
 * 설계 근거: docs/01-architecture/01-schema.md, 00-overview.md §3
 */

import type { Schema, BlockSpec, DirectiveSpec } from "./types.js";

export * from "./types.js";

/**
 * 스키마를 감싸 조회 메서드를 제공한다.
 * 파서·검증·hover·completion 의 단일 진입점.
 */
export class SchemaIndex {
  constructor(private readonly schema: Schema) {}

  get version(): string {
    return this.schema.version;
  }

  /** 모든 블록 이름. */
  blockNames(): string[] {
    return Object.keys(this.schema.blocks);
  }

  /** 블록 정의 조회. alias 면 canonical 로 해석해 반환. */
  block(name: string): BlockSpec | undefined {
    const spec = this.schema.blocks[name];
    if (!spec) return undefined;
    if (spec.aliasOf) return this.schema.blocks[spec.aliasOf];
    return spec;
  }

  /** 원본 블록 정의 (alias 해석 안 함). */
  rawBlock(name: string): BlockSpec | undefined {
    return this.schema.blocks[name];
  }

  /** 블록 키워드가 스키마에 존재하는가 (alias 포함). */
  hasBlock(name: string): boolean {
    return name in this.schema.blocks;
  }

  /** 최상위(root) 블록 여부. */
  isRoot(name: string): boolean {
    const spec = this.block(name);
    return spec?.root === true;
  }

  /**
   * 블록 keyword 를 canonical 이름으로 정규화.
   * alias 가 아니면 그대로 반환.
   */
  canonicalBlock(name: string): string {
    const spec = this.schema.blocks[name];
    return spec?.aliasOf ?? name;
  }

  /**
   * 특정 블록 안의 지시어 정의 조회. alias 지시어면 canonical 로 해석.
   */
  directive(blockName: string, directiveName: string): DirectiveSpec | undefined {
    const block = this.block(blockName);
    const dir = block?.directives?.[directiveName];
    if (!dir) return undefined;
    if (dir.aliasOf) return block?.directives?.[dir.aliasOf];
    return dir;
  }

  /** 블록 안 지시어 keyword 를 canonical 로 정규화. */
  canonicalDirective(blockName: string, directiveName: string): string {
    const block = this.block(blockName);
    const dir = block?.directives?.[directiveName];
    return dir?.aliasOf ?? directiveName;
  }

  /** 블록 안의 모든 지시어 이름. */
  directiveNames(blockName: string): string[] {
    const block = this.block(blockName);
    return block?.directives ? Object.keys(block.directives) : [];
  }

  /** 블록이 중첩 허용하는 자식 블록 이름들. */
  subBlocks(blockName: string): string[] {
    return this.block(blockName)?.subBlocks ?? [];
  }

  /**
   * 주어진 블록이 부모 블록 안에 올 수 있는가.
   * - root 블록: 최상위에서만 (parent 없을 때) 유효.
   * - 비-root 블록: validParents 에 부모가 포함되거나, 부모의 subBlocks 에 포함되면 유효.
   */
  isValidChild(childName: string, parentName: string | null): boolean {
    const child = this.block(childName);
    if (!child) return false;
    if (parentName === null) {
      return child.root === true;
    }
    if (child.validParents && child.validParents.includes(parentName)) return true;
    return this.subBlocks(parentName).includes(this.canonicalBlock(childName))
      || this.subBlocks(parentName).includes(childName);
  }
}

/** Schema 객체를 SchemaIndex 로 감싼다. */
export function createSchemaIndex(schema: Schema): SchemaIndex {
  return new SchemaIndex(schema);
}
