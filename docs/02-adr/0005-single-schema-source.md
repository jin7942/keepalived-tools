# ADR-0005: 단일 스키마 (Single Source of Truth)

- 상태: Accepted
- 날짜: 2026-06-29
- 출처: TD-5 승격

## Context

파서·검증·hover·completion이 각자 지시어 규칙을 들고 있으면 불일치 위험.

## Decision

규칙을 `schema/keepalived-spec.merged.json` **한 곳**에 정의. 모든 소비자가 이를 읽는다.

## Consequences

- (+) 불일치 위험 제거. 하드코딩·매직넘버 금지(설정 중앙화).
- (+) 버전 대응 = 스키마만 갱신.
- 구조: `spec.json`(자동) + `overrides.json`(수작업) → `merged.json`(런타임 로드).
- `spec.json`/`overrides.json` 은 커밋·버전 관리. `merged.json` 은 **빌드 산출물**이라
  `.gitignore` 처리(빌드 시 재생성). 번들엔 esbuild 가 인라인.

## Alternatives

- 기능별 분산 규칙: 불일치 불가피. 기각.
