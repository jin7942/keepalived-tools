/**
 * Formatter 어댑터: core.format → 전체 문서 치환 TextEdit.
 */

import * as vscode from "vscode";
import { format } from "../core/features/index.js";

export class KeepalivedFormatter implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
    const formatted = format(document.getText(), { indent });
    if (formatted === document.getText()) return [];
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    return [vscode.TextEdit.replace(fullRange, formatted)];
  }
}
