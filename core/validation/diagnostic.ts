/**
 * 진단 데이터 형식 (순수).
 *
 * vscode 어댑터가 vscode.Diagnostic 으로 1:1 변환한다.
 * 신뢰성 우선: 확실한 것만 error, 불확실하면 warning/info/침묵 (validation §1.1).
 *
 * 설계 근거: docs/01-architecture/03-validation.md §1
 */

import type { Range } from "../parser/ast.js";

export type Severity = "error" | "warning" | "info";

export interface RelatedInfo {
  range: Range;
  message: string;
}

export interface Diagnostic {
  range: Range;
  severity: Severity;
  /** 에러 코드 (CLAUDE.md 에러코드 체계: <도메인>_<상태>). */
  code: string;
  /** 사람이 읽는 메시지 (친절·명확). */
  message: string;
  /** 연관 위치 (예: 중복의 원본 정의). */
  related?: RelatedInfo[];
}

export function diag(
  range: Range,
  severity: Severity,
  code: string,
  message: string,
  related?: RelatedInfo[]
): Diagnostic {
  const d: Diagnostic = { range, severity, code, message };
  if (related && related.length) d.related = related;
  return d;
}
