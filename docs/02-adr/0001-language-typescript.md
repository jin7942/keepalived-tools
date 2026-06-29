# ADR-0001: 언어 = TypeScript 단일

- 상태: Accepted
- 날짜: 2026-06-29
- 출처: TD-1 승격 (`00-planning/01-tech-decisions.md`)

## Context

VSCode 익스텐션 본체와 검증 엔진(`core`)의 구현 언어를 정해야 한다.
검증 엔진은 이론상 WASM(Rust/Go)으로도 가능하다.

## Decision

익스텐션 본체와 `core` 모두 **TypeScript 단일**.

## Consequences

- (+) 익스텐션 본체는 VSCode가 Node.js로 로드 → TS/JS 강제. core까지 TS면 타입 공유.
- (+) keepalived 설정은 작은 텍스트 → TS 파서로 성능 충분.
- (+) 빌드·번들·디버깅 단순.
- (−) CPU 집약 검증이 필요해지면 재고. 현재 규모에선 무의미.

## Alternatives

- Rust/Go + WASM: 성능 이득 미미, 빌드/번들 복잡도 폭증. 기각.
