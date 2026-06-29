# ADR-0007: 테스트 러너 = node:test + tsx

- 상태: Accepted
- 날짜: 2026-06-29

## Context

core(순수 로직) 테스트 러너 선택. CLAUDE.md 테스트 컨벤션(AAA, 행동 검증, <1분) 충족 필요.

## Decision

- **core 단위/통합**: Node 내장 `node:test` + `node:assert/strict`, `tsx`로 TS 직접 실행.
- 외부 의존(jest/vitest) 없이 표준 라이브러리만.

## Consequences

- (+) 의존성 최소(devDep만). 빠른 시작, 설정 거의 없음.
- (+) core가 vscode 비의존이라 순수 Node에서 전량 실행 가능.
- (−) vscode 어댑터 통합 테스트는 `@vscode/test-electron` 필요(S13에서 별도).
- (−) jest 스냅샷/모킹 풍부함은 없음. 그러나 core는 순수 함수라 stub로 충분.

## Alternatives

- vitest: 좋지만 의존성·설정 추가. node:test로 충분. 기각.
- jest: ts 트랜스폼 설정 무겁다. 기각.
