/**
 * include 링크 후보 (순수).
 *
 * `include <glob>` 지시어의 glob 텍스트 위치와 원본 glob 문자열을 돌려준다.
 * 어댑터가 glob 을 실제 파일로 resolve 해 DocumentLink 로 만든다(클릭 이동).
 *
 * VSCode 의존 없음 (ADR-0002).
 */

import { parse } from "../parser/index.js";
import type { Range } from "../parser/ast.js";
import { collectIncludes } from "../validation/walk.js";

export interface IncludeLink {
  /** include 대상 glob (원본). */
  glob: string;
  /** include 지시어 전체 범위. */
  range: Range;
}

/** 텍스트에서 모든 include 지시어를 찾아 glob+range 로 반환 (중첩 포함). */
export function includeLinks(text: string): IncludeLink[] {
  return collectIncludes(parse(text).ast).map((n) => ({ glob: n.glob, range: n.range }));
}
