# ADR-0006: 빌드 도구 = esbuild + tsc

- 상태: Accepted
- 날짜: 2026-06-29

## Context

TS 익스텐션을 VSCode가 로드하려면 번들/컴파일이 필요하다. 도구 선택.

## Decision

- **번들**: esbuild (extension.ts → dist/extension.js, CommonJS, `vscode` external).
- **타입체크**: tsc `--noEmit` (별도 스텝, 빌드 차단용).
- core는 vscode 의존이 없어 단위 테스트에서 tsx로 직접 로드(번들 불필요).

## Consequences

- (+) esbuild 빠름, 설정 최소. tsc는 타입 안전만 담당(관심사 분리).
- (+) `vscode`를 external로 두면 번들 크기 작음.
- (−) 두 도구 운용. 그러나 역할이 명확(번들 vs 타입체크)해 혼동 없음.

## Alternatives

- webpack: 설정 무겁다. 익스텐션 규모에 과잉. 기각.
- tsc 단독 번들: 멀티파일 출력·트리셰이킹 약함. 기각.
