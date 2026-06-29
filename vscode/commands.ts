/**
 * 명령 팔레트 commands 등록.
 *
 * - keepalived.showSchemaVersion: 적용 중 스키마(keepalived 버전·블록 수) 표시.
 * - keepalived.validateActiveFile: 활성 문서 재검증 트리거(디바운스 무시 즉시).
 * - keepalived.formatDocument: 활성 문서 포맷(표준 Format Document 단축).
 */

import * as vscode from "vscode";
import { getSchema } from "../core/schema/load.js";
import type { RevalidateNow } from "./diagnostics.js";

const LANGUAGE_ID = "keepalived";

export function registerCommands(
  context: vscode.ExtensionContext,
  revalidate: RevalidateNow
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("keepalived.showSchemaVersion", () => {
      const schema = getSchema();
      const blocks = schema.blockNames().length;
      void vscode.window.showInformationMessage(
        `Keepalived schema: v${schema.version} · ${blocks} blocks`
      );
    }),

    vscode.commands.registerCommand("keepalived.formatDocument", async () => {
      if (!activeKeepalivedEditor()) return;
      await vscode.commands.executeCommand("editor.action.formatDocument");
    }),

    vscode.commands.registerCommand("keepalived.validateActiveFile", () => {
      const ed = activeKeepalivedEditor();
      if (!ed) return;
      void vscode.window.setStatusBarMessage("Keepalived: validating…", 1500);
      revalidate(ed.document);
    })
  );
}

function activeKeepalivedEditor(): vscode.TextEditor | undefined {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.document.languageId !== LANGUAGE_ID) {
    void vscode.window.showWarningMessage("No active keepalived.conf document.");
    return undefined;
  }
  return ed;
}
