/**
 * Definition 어댑터: core.definitionAt → vscode.Location.
 *
 * 커서가 track_script/real_server 등 ref 값 위면 그 정의로 점프.
 * 단일 파일 기준(include 크로스파일 점프는 v1.x).
 */

import * as vscode from "vscode";
import { definitionAt } from "../core/features/index.js";
import { toVsRange } from "./convert.js";

export class KeepalivedDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Definition> {
    const def = definitionAt(document.getText(), position.line, position.character);
    if (!def) return undefined;
    return new vscode.Location(document.uri, toVsRange(def.range));
  }
}
