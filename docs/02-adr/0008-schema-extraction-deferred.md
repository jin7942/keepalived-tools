# ADR-0008: S1 추출기 후순위, 수작업 시드 스키마 우선

- 상태: Accepted
- 날짜: 2026-06-29

## Context

로드맵은 S1(자동 추출기)을 거의 모든 단계의 토대로 둔다. 그러나 실측 결과
추출기는 **크로스파일 콜그래프 추적 + 상수 해석 + override 병합**이라 난도 최상(S1a~S1e).
추출기 완성 전까지 파서/검증/UI를 못 만들면 출시 경로가 막힌다.

핵심 통찰: 파서·검증·hover·completion은 **merged.json 스키마**만 있으면 동작한다.
merged.json은 `spec.json`(추출 산출) + `overrides.json`(수작업) 병합이다.
**spec.json이 비어 있어도, overrides.json만 충실하면 merged.json은 완성된다.**

## Decision

추출기(S1) 구현을 **출시 필수 경로에서 분리**한다.

1. 먼저 `schema/overrides.json`에 **핵심 19블록 + 주요 지시어를 수작업으로 시드**한다
   (소스 실측 근거는 schema 문서에 이미 file:line으로 확보됨).
2. `spec.json`은 빈 골격(`{"version":"2.3.4","blocks":{}}`)으로 시작.
3. `merge-overrides`는 그대로 동작 → `merged.json` 생성.
4. 이 merged.json으로 파서·검증·UI·테스트를 **전부 완성**한다.
5. 추출기(walk-registration/infer-types/resolve-consts)는 v1.0 이후 또는 여력 시
   구현해 spec.json을 채우고, overrides는 자동화 못 한 부분만 남긴다.

## Consequences

- (+) 출시 경로에서 최대 난점(콜그래프 추출기) 제거 → v1.0 도달 가능.
- (+) override 레이어 설계가 그대로 활용됨(스키마 구조 변경 없음).
- (+) 시드 대상은 실제 conf에서 흔한 지시어 위주 → 사용자 체감 커버리지 우선.
- (−) 초기 스키마 커버리지가 추출기보다 낮을 수 있음 → 흔한 지시어부터 점진 확장.
- (−) spec.json/overrides.json 역할이 한시적으로 역전(overrides가 주력) →
  추출기 도입 시 일부 항목을 spec.json으로 이관(`source` 필드로 추적 가능).

## Alternatives

- 추출기부터 완성: 난도 최상, 출시 지연 위험. v1.0 차단 요인. 기각(후순위로).
- spec.json도 수작업: 자동/수작업 경계가 흐려짐. overrides 단일 창구가 명확. 기각.
