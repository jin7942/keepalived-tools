/**
 * 어댑터 경계의 예외 처리.
 *
 * core·provider 는 예외를 잡지 않고 전파하고, 경계(provider/이벤트 콜백)에서만
 * 감싼다. 한 문서/한 호출의 실패가 기능 전체를 깨뜨리지 않게 한다.
 */

import * as vscode from "vscode";

const channel = vscode.window.createOutputChannel("Keepalived");

/** 동기 provider 콜백을 감싼다. 예외 시 fallback 반환 + 로깅. */
export function guard<T>(op: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    report(op, err);
    return fallback;
  }
}

/** 비동기 부수효과 작업을 감싼다. 예외 시 onError 로 정리 + 로깅. */
export async function guardAsync(
  op: string,
  fn: () => Promise<void>,
  onError?: (err: unknown) => void
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    report(op, err);
    onError?.(err);
  }
}

function report(op: string, err: unknown): void {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  channel.appendLine(`[${op}] ${msg}`);
  console.error(`keepalived: ${op} failed`, err);
}
