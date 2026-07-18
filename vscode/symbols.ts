/**
 * DocumentSymbol 어댑터: core.outline → vscode.DocumentSymbol (아웃라인/브레드크럼).
 */

import * as vscode from "vscode";
import { outline, type DocSymbol } from "../core/features/index.js";
import { toVsRange } from "./convert.js";
import { guard } from "./errorBoundary.js";

export class KeepalivedSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    return guard("documentSymbol", () => outline(document.getText()).map(toVs), []);
  }
}

function toVs(s: DocSymbol): vscode.DocumentSymbol {
  const sym = new vscode.DocumentSymbol(
    s.name,
    s.detail,
    vscode.SymbolKind.Struct,
    toVsRange(s.range),
    toVsRange(s.selectionRange)
  );
  sym.children = s.children.map(toVs);
  return sym;
}
