/**
 * core 데이터 ↔ VSCode 객체 변환 유틸.
 * core 의 0-based line/col 은 vscode 와 동일 좌표계.
 */

import * as vscode from "vscode";
import type { Range as CoreRange } from "../core/parser/ast.js";
import type { Severity } from "../core/validation/index.js";

export function toVsRange(r: CoreRange): vscode.Range {
  return new vscode.Range(r.start.line, r.start.col, r.end.line, r.end.col);
}

export function toVsSeverity(s: Severity): vscode.DiagnosticSeverity {
  switch (s) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
  }
}
