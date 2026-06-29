/**
 * VSCode 익스텐션 진입점 (얇은 어댑터).
 *
 * core(순수)를 호출해 결과를 VSCode 객체로 매핑한다. 로직은 core 에 있다(ADR-0002).
 * 책임: activate, fs 읽기(include), DiagnosticCollection, provider 등록, debounce.
 *
 * 설계 근거: docs/01-architecture/00-overview.md §3, §4
 */

import * as vscode from "vscode";
import { registerDiagnostics } from "./diagnostics.js";
import { KeepalivedHoverProvider } from "./hover.js";
import { KeepalivedCompletionProvider } from "./completion.js";
import { KeepalivedFormatter } from "./formatter.js";

const LANGUAGE_ID = "keepalived";
const selector: vscode.DocumentSelector = { language: LANGUAGE_ID };

export function activate(context: vscode.ExtensionContext): void {
  registerDiagnostics(context);

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new KeepalivedHoverProvider()),
    vscode.languages.registerCompletionItemProvider(
      selector,
      new KeepalivedCompletionProvider(),
      " ",
      "\n"
    ),
    vscode.languages.registerDocumentFormattingEditProvider(selector, new KeepalivedFormatter())
  );
}

export function deactivate(): void {
  // DiagnosticCollection 은 context.subscriptions 로 자동 정리.
}
