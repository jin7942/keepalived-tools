# ADR-0004: --config-test 미사용, 자체 검증 엔진

- 상태: Accepted
- 날짜: 2026-06-29
- 출처: TD-4 승격

## Context

keepalived 바이너리의 `-t`/`--config-test`는 줄 번호까지 주는 검증을 제공한다.
이를 호출할지, 자체 검증 엔진을 만들지.

## Decision

`--config-test`를 **호출하지 않는다.** 검증은 자체 파서·검증 엔진으로 구현.

## Consequences

- (+) keepalived 미설치 환경(Windows 등)에서도 동작. 플랫폼 독립.
- (−) keepalived의 검증 정확도를 직접 재현해야 함 → 소스의 `config_err_t` 참고.
- 참고: 검증 로직 자체는 keepalived 소스를 참조해 이식 (GPL 수용으로 가능).

## Alternatives

- `--config-test` 호출: 설치 의존 → 익스텐션이 환경 의존. 기각.
