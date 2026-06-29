/**
 * Formatter 어댑터: core.format → 전체 문서 치환 TextEdit.
 */

import * as vscode from "vscode";
import { format } from "../core/features/index.js";
import { guard } from "./errorBoundary.js";

export class KeepalivedFormatter implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    return guard("format", () => {
      const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
      const original = document.getText();
      const formatted = format(original, { indent });
      if (formatted === original) return [];
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(original.length)
      );
      return [vscode.TextEdit.replace(fullRange, formatted)];
    }, []);
  }
}
