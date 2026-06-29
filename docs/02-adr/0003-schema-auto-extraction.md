# ADR-0003: 스키마 소스 자동 추출

- 상태: Accepted
- 날짜: 2026-06-29
- 출처: TD-3 승격 + 2.3.4 소스 실측

## Context

지시어·타입·중첩·범위 규칙을 어떻게 확보할지. 수작업 전수 입력은 비용·오류가 크고
keepalived 새 버전 대응이 어렵다.

## Decision

keepalived 소스의 키워드 등록 구조(`install_keyword*`)를 **정적 파싱하여 자동 추출**.
자동 불가분(strcmp enum, #ifdef enum, 설명)은 `overrides.json` 수작업 보정.

## Consequences

- (+) 새 버전 = 추출 재실행. 코드 수정 불필요.
- (+) 범위(min/max)는 `read_*_strvec` 콜사이트 인자로 ~70-80% 자동.
- (−) 헬스체커는 크로스파일 콜그래프 등록 → 추출기가 콜그래프 추적 필요(난점).
- (−) 추출기 자체가 별도 도구. 빌드 타임 전용, 배포물 미포함.
- 참고: 상세 file:line 근거는 `01-architecture/01-schema.md`.

## Alternatives

- 런타임 덤프(`--enable-dump-keywords`): keepalived 빌드 환경 필요. 기각.
- 전량 수작업: 비용·버전 대응 불리. 기각.
