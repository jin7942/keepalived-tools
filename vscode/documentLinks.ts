/**
 * DocumentLink 어댑터: include glob → 클릭 가능한 파일 링크.
 *
 * glob 을 resolve 해 실제 파일들로 링크한다. 매치가 1개면 그 파일,
 * 여러 개면 첫 파일로(가장 흔한 단일 include 케이스를 우선).
 */

import * as vscode from "vscode";
import * as path from "node:path";
import { includeLinks } from "../core/features/index.js";
import { resolveGlob } from "./includeResolver.js";
import { toVsRange } from "./convert.js";
import { guard } from "./errorBoundary.js";

export class KeepalivedDocumentLinkProvider implements vscode.DocumentLinkProvider {
  async provideDocumentLinks(
    document: vscode.TextDocument
  ): Promise<vscode.DocumentLink[]> {
    const links = guard("documentLink", () => includeLinks(document.getText()), []);
    if (links.length === 0) return [];

    const baseDir = path.dirname(document.uri.fsPath);
    const out: vscode.DocumentLink[] = [];
    for (const l of links) {
      const targets = await resolveGlob(baseDir, l.glob);
      if (targets.length === 0) continue;
      const link = new vscode.DocumentLink(toVsRange(l.range), vscode.Uri.file(targets[0]));
      link.tooltip =
        targets.length > 1
          ? `${path.basename(targets[0])} 외 ${targets.length - 1}개`
          : path.basename(targets[0]);
      out.push(link);
    }
    return out;
  }
}
