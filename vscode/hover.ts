/**
 * Hover 어댑터: core.hoverAt → vscode.Hover.
 */

import * as vscode from "vscode";
import { hoverAt } from "../core/features/index.js";
import { toVsRange } from "./convert.js";

export class KeepalivedHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    const result = hoverAt(document.getText(), position.line, position.character);
    if (!result) return null;
    const md = new vscode.MarkdownString(result.markdown);
    md.isTrusted = false;
    return new vscode.Hover(md, result.range ? toVsRange(result.range) : undefined);
  }
}
