# ADR-0014: 구조 내비게이션·명령·문법 강화 (0.23.0)

- 상태: Accepted
- 날짜: 2026-06-29

## Context

감사(feature-auditor) 결과, 분석 엔진은 제품급이나 VSCode 어댑터 표면에서
표준 내비게이션·발견성 기능이 비어 있었다: 아웃라인 없음, include 클릭 이동 없음,
명령 팔레트 항목 0개, 문법이 RFP §3.1의 `~SEQ()`·IP/CIDR를 강조하지 않음.

## Decision

core(순수)에 로직, 어댑터는 얇게(ADR-0002) 원칙으로 추가:

1. **DocumentSymbol(아웃라인)** — `core/features/outline.ts` 블록 트리 → 심볼 트리.
   지시어는 노이즈라 블록만. 브레드크럼·접기 품질 동반 향상.
2. **DocumentLink(include 클릭 이동)** — `core/features/links.ts` 로 include glob+range
   추출, glob resolve 는 어댑터(`includeResolver.ts`)가 수행. resolve 로직을 진단과
   공유하도록 별도 모듈로 추출, 심링크 디렉토리 순환 방지·결과 정렬 안정화.
3. **commands** — `keepalived.showSchemaVersion / validateActiveFile / formatDocument`.
   validate 는 진단의 즉시 재검증 함수(`RevalidateNow`)를 호출(강제 저장 부작용 없음).
4. **문법** — 생성기에 `~SEQ()`·IPv4/IPv6·CIDR·BOOL 규칙 추가. IP가 numbers 보다
   우선 매칭되도록 patterns 순서 조정.

## Consequences

- (+) 표준 IDE 내비게이션 확보 — 다중 파일 설정에서 include 추적이 1클릭.
- (+) RFP §3.1 문법 준수(시퀀스·IP 강조).
- (+) resolve 단일화로 진단·링크 동작 일치, 중복 제거.
- (−) IPv6 강조는 간이 정규식(정밀 검증은 검증층) — 오색칠 가능성 낮으나 0 아님.
- (−) DocumentLink 는 glob 다중 매치 시 첫 파일로만 이동(흔한 단일 케이스 우선).
- publisher placeholder 는 사용자 자산이라 미해결(배포 시 교체 필요).
