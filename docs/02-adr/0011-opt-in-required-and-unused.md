# ADR-0011: required 누락·미참조 진단은 기본 off (opt-in)

- 상태: Accepted
- 날짜: 2026-06-29

## Context

의미층은 "필수 지시어 누락(SEMANTIC_MISSING_REQUIRED)"과 "미참조(SEMANTIC_UNUSED)"를
검출할 수 있다. 그러나 편집 중에는 이 둘이 오탐을 양산한다:

- 사용자가 블록을 막 열어 타이핑 중 → 필수 지시어가 아직 없음(정상).
- `@조건부`·`include` 로 다른 줄/파일에 필수값이 있을 수 있음.
- 정의한 vrrp_script 를 아직 참조 안 했어도 정상(곧 쓸 예정).

validation §1.1: "오탐 1건이 신뢰 10건을 깎는다."

## Decision

`SEMANTIC_MISSING_REQUIRED` 와 `SEMANTIC_UNUSED` 를 **기본 비활성화**한다.
`reportMissingRequired` / `reportUnused` 옵션으로만 켠다(저장 시 검사 등 명시적 상황용).

검출 로직 자체는 구현해 둔다 — 끄고 켜기만 옵션으로.

## Consequences

- (+) 편집 중 빨간/노란 줄 폭발 방지 → 신뢰성 우선.
- (+) 로직은 살아 있어, 향후 "파일 저장 시 엄격 검사" 같은 모드로 노출 가능.
- (−) 기본 모드에선 진짜 필수 누락도 안 잡음 → 사용자가 원하면 설정으로 on.
- 향후: VSCode 설정(`keepalived.validation.strict`)으로 사용자 토글 노출(S12).

## Alternatives

- required 를 warning 으로: 여전히 편집 중 노이즈. 기각.
- 항상 on: 오탐 과다. 기각.
