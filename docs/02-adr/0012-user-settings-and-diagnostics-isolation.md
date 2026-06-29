# ADR-0012: 사용자 설정 노출 + 진단 경로 격리

- 상태: Accepted
- 날짜: 2026-06-29

## Context

ADR-0011 에서 `reportMissingRequired`/`reportUnused` 를 옵션으로만 켜기로 했고,
"향후 VSCode 설정으로 노출(S12)"을 예고했다. 0.1.0 시점엔 core 가 옵션을 받지만
어댑터가 옵션을 넘기지 않고 `contributes.configuration` 도 없어 — 설계·구현된 기능이
사용자에게 도달 불가한 dead code 였다. 1.0 정식 릴리스에서 이 격차를 닫아야 한다.

또한 디바운스 검증 콜백(`runValidation`)이 `void` 로 호출돼 예외가 unhandled rejection
이 되면 진단이 stale 상태로 굳을 수 있었다. 대용량 생성 설정에서 매 타이핑 전체 재파싱은
에디터를 지연시킨다.

## Decision

1. `contributes.configuration` 에 4개 설정 노출:
   - `keepalived.validation.enable` (기본 true)
   - `keepalived.validation.reportMissingRequired` (기본 false, ADR-0011)
   - `keepalived.validation.reportUnused` (기본 false, ADR-0011)
   - `keepalived.validation.maxFileSize` (기본 1MB, 0 = 무제한)
2. 어댑터가 문서별 설정을 읽어 core `ValidateOptions` 로 변환·전달.
   설정 변경 시(`onDidChangeConfiguration`) 열린 문서 전부 재검증.
3. `runValidation` 전체를 try/catch 로 감싼다 — 한 문서의 예외가 기능 전체를 깨지
   않게. 실패 시 진단을 비우고 콘솔에만 기록.
4. `maxFileSize` 초과 파일은 검증 생략(진단 비움).
5. `validateFiles`→`validateInclude` 가 `reportMissingRequired` 를 전달하도록
   옵션 객체로 시그니처 통일(누락 옵션 버그 수정).

## Consequences

- (+) ADR-0011 이 약속한 토글이 실제로 동작 — dead code 해소.
- (+) 단일 불량 문서가 전체 진단을 마비시키지 못함.
- (+) 거대 설정에서 에디터 응답성 유지.
- (−) 설정 표면이 늘어 문서화 부담(README 설정 표로 해소).
- core 는 여전히 fs·vscode 비의존(ADR-0002) — 설정 해석은 전부 어댑터 책임.
