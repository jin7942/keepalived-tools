# ADR-0002: LSP 미채택, core/adapter 분리

- 상태: Accepted
- 날짜: 2026-06-29
- 출처: TD-2 승격

## Context

검증·완성 로직을 LSP(Language Server Protocol)로 별도 프로세스화할지,
VSCode 내부 API로 직접 처리할지 선택해야 한다.

## Decision

v1.0에 **LSP 미도입.** 검증은 VSCode 내부 API(`DiagnosticCollection` 등)로 처리.
단, 로직은 VSCode API에서 분리한 **순수 `core` 모듈**로 작성해 추후 LSP 어댑터로 감쌀 수 있게 한다.

## Consequences

- (+) 별도 프로세스·JSON-RPC 셋업 불필요 → 복잡도 감소.
- (+) core가 순수하면 나중에 LSP 어댑터만 추가, core 불변 (DIP).
- (−) 현재 VSCode 외 에디터 미지원. 요구 생기면 v1.x.
- 제약: **core는 vscode를 import하지 않는다.** fs 접근도 어댑터 책임.

## Alternatives

- 처음부터 LSP: 다중 에디터 실익이 현재 없음. 과잉. 기각.
