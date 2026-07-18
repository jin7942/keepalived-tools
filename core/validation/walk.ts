/**
 * AST 순회 헬퍼 + alias 정규화.
 *
 * 검증 각 층이 공통으로 쓰는 트리 워크. 블록을 부모 컨텍스트와 함께 방문한다.
 * alias 정규화는 전 층 진입 전 1회 (validation §2): keyword 가 aliasOf 면 canonical 로 치환.
 *
 * 설계 근거: docs/01-architecture/03-validation.md §2
 */

import type { Block, BlockChild, ConfFile, Directive, IncludeDirective } from "../parser/ast.js";
import type { SchemaIndex } from "../schema/index.js";

/**
 * AST 의 블록·지시어 keyword 를 canonical 로 정규화한 새 트리를 만든다.
 * 원본은 보존(순수 함수). 위치 정보는 그대로 유지.
 */
export function normalizeAliases(file: ConfFile, schema: SchemaIndex): ConfFile {
  return { ...file, body: file.body.map((c) => normalizeChild(c, null, schema)) };
}

function normalizeChild(child: BlockChild, parent: string | null, schema: SchemaIndex): BlockChild {
  if (child.type === "block") {
    const canonical = schema.canonicalBlock(child.keyword);
    return {
      ...child,
      keyword: canonical,
      body: child.body.map((c) => normalizeChild(c, canonical, schema)),
    };
  }
  if (child.type === "directive") {
    if (parent) {
      const canonical = schema.canonicalDirective(parent, child.keyword);
      if (canonical !== child.keyword) {
        return { ...child, keyword: canonical };
      }
    }
    return child;
  }
  return child; // include
}

export interface BlockVisit {
  block: Block;
  /** 부모 블록 canonical 이름. 최상위면 null. */
  parent: string | null;
}

export interface DirectiveVisit {
  directive: Directive;
  /** 이 지시어를 담은 블록 canonical 이름. 최상위면 null. */
  parent: string | null;
}

/** 모든 블록을 부모와 함께 방문 (DFS). */
export function walkBlocks(file: ConfFile, visit: (v: BlockVisit) => void): void {
  const recur = (children: BlockChild[], parent: string | null) => {
    for (const c of children) {
      if (c.type === "block") {
        visit({ block: c, parent });
        recur(c.body, c.keyword);
      }
    }
  };
  recur(file.body, null);
}

/**
 * 모든 include 지시어를 수집 (중첩 블록 안까지 재귀).
 * keepalived 는 블록 안에서도 include 를 허용하므로 ast.body 만 보면 안 된다.
 */
export function collectIncludes(file: ConfFile): IncludeDirective[] {
  const out: IncludeDirective[] = [];
  const recur = (children: BlockChild[]) => {
    for (const c of children) {
      if (c.type === "include") out.push(c);
      else if (c.type === "block") recur(c.body);
    }
  };
  recur(file.body);
  return out;
}

/** 모든 지시어를 담은 블록과 함께 방문 (DFS). */
export function walkDirectives(file: ConfFile, visit: (v: DirectiveVisit) => void): void {
  const recur = (children: BlockChild[], parent: string | null) => {
    for (const c of children) {
      if (c.type === "directive") {
        visit({ directive: c, parent });
      } else if (c.type === "block") {
        recur(c.body, c.keyword);
      }
    }
  };
  recur(file.body, null);
}
