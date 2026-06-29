/**
 * Completion 어댑터: core.completeAt → vscode.CompletionItem[].
 */

import * as vscode from "vscode";
import { completeAt, type CompletionItem, type CompletionKind } from "../core/features/index.js";

export class KeepalivedCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const items = completeAt(document.getText(), position.line, position.character);
    return items.map((i) => toVsItem(i));
  }
}

function toVsItem(item: CompletionItem): vscode.CompletionItem {
  const vi = new vscode.CompletionItem(item.label, kindToVs(item.kind));
  if (item.detail) vi.detail = item.detail;
  if (item.insertText) {
    vi.insertText = item.isSnippet
      ? new vscode.SnippetString(item.insertText)
      : item.insertText;
  }
  return vi;
}

function kindToVs(kind: CompletionKind): vscode.CompletionItemKind {
  switch (kind) {
    case "block":
      return vscode.CompletionItemKind.Struct;
    case "directive":
      return vscode.CompletionItemKind.Property;
    case "enum":
      return vscode.CompletionItemKind.EnumMember;
    case "value":
      return vscode.CompletionItemKind.Value;
  }
}
