/**
 * CodeAction 어댑터: 진단 → "did you mean ...?" quick-fix.
 *
 * core.quickFixesFor 가 신뢰성 우선으로 근접 후보만 돌려준다(오타 수준).
 * 어댑터는 진단 range 의 텍스트를 후보로 치환하는 WorkspaceEdit 를 만든다.
 */

import * as vscode from "vscode";
import { quickFixesFor } from "../core/features/index.js";
import { guard } from "./errorBoundary.js";

const FIXABLE = new Set(["TYPE_INVALID_ENUM", "SYNTAX_UNKNOWN_DIRECTIVE"]);

export class KeepalivedCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    return guard("codeAction", () => this.collect(document, context), []);
  }

  private collect(
    document: vscode.TextDocument,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const text = document.getText();

    for (const d of context.diagnostics) {
      if (d.source !== "keepalived") continue;
      const code = typeof d.code === "string" ? d.code : String(d.code ?? "");
      if (!FIXABLE.has(code)) continue;

      const badText = document.getText(d.range);
      const fixes = quickFixesFor(text, code, badText, d.range.start.line, d.range.start.character);
      for (const fix of fixes) {
        const action = new vscode.CodeAction(
          `Replace with '${fix.replacement}'`,
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [d];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, d.range, fix.replacement);
        actions.push(action);
      }
    }
    return actions;
  }
}
