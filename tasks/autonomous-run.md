# 48h 자율주행 운영 보드

> 시작: 2026-06-29 ~17:10. 종료 목표: 2026-07-01 ~17:10.
> 브랜치: `0.23.0` 단일. 커밋 누적. 결정 자율 + ADR 문서화.
> 목표: 분석/RFP 전부 구현, 즉시 운영 가능·제품급 안정성, UI/UX 포함.
> 원칙: 가라 금지. 기획→설계→구현→리뷰 반복. 매 사이클 빌드+테스트 green 유지.

## 진행 규율 (매 사이클)
1. 한 항목 선택 → 설계(필요시 ADR) → 구현 → 테스트 → 커밋.
2. 커밋 단위 작게. 항상 tsc+test green 후 커밋.
3. 문서 최신화: README/CHANGELOG/ADR/이 보드.
4. 가라 금지: 소스 실측·직접 실행으로 검증.

## 백로그 (우선순위)

### P0 — 안정성·정확성 (제품급 핵심)
- [ ] 전 provider 예외 경계(guard) 일관 적용 + 로깅 채널.
- [ ] core 도메인 에러 계층 정리(파서/스키마) — throw 지점 명확화.
- [ ] 대용량/엣지 입력 견고성: 빈 파일, BOM, CRLF, 탭, 깊은 중첩, 거대 토큰.
- [ ] include 경로 보안/순환/심링크/존재X 견고성 재점검.
- [ ] 진단 위치(range) 정확도 감사 — off-by-one, 멀티바이트.

### P1 — 기능 완성도 (RFP/분석자료)
- [ ] 스키마 커버리지 추가 확대 + 흔한 블록 complete:true 안전 부여.
- [ ] 값 타입 검증 강화: cidr/ip6/timer 단위/포트범위/ref 다중.
- [ ] 포맷터 품질: range 포맷, on-type, 정렬 옵션, 멱등성 보장 확대.
- [ ] completion 문맥 정밀화: enum/ref 후보, 블록 스니펫, 트리거.
- [ ] hover 품질: 출처 링크, 기본값, 예시.
- [ ] 명령 팔레트 commands(검증/포맷/스키마버전).

### P2 — UI/UX
- [ ] 진단 메시지 문구 일관성·친절성 감사(코드별 카피 정리).
- [ ] 설정 UI 그룹/순서/설명 정리.
- [ ] README 스크린샷/GIF 자리 + 사용 흐름.
- [ ] 스니펫 확충(sync_group/static_*/health checks).
- [ ] 아이콘/배너 톤 재점검.

### P3 — 품질 인프라
- [ ] 린트(no-console 등) 도입 또는 정책 명시.
- [ ] 테스트 커버리지 갭(파서 엣지, 포맷터, include).
- [ ] @vscode/test-electron 통합 테스트 1차.
- [ ] CI 워크플로(빌드+테스트) 초안.

## 사이클 로그
- C1 17:15 / 예외 경계 일관 적용(guard 전 provider) / test 77 green / de79127
  - 감사 에이전트 2종(quality/feature) 가동 — 백로그 정밀화 대기.
- C4 (자율틱) / 공식 샘플 25종 검증 → 거짓양성 1건 발견·수정 / test 106 green
  - status_code 다중·범위(200-299) 단일 int 오인 → type 제거(name-only).
  - 공식 doc/samples 16종 fixture 회귀: error 진단 0 보장 (신뢰성 결정 증거).
  - 커밋 8e02a6b.
- C3 ~17:40 / quality 감사 전면 반영(C1·H1·H2·M1~M4·L1~L3) / test 90 green
  - C1 중첩include, H1 BOM, H2 캐시/버퍼, M1 순환진단, M2 NEWLINE,
    M3 심볼키, M4 glob/심링크, L1~L3 정리. CRLF·멀티바이트 회귀.
  - ADR-0015, CHANGELOG Fixed 섹션, 운영보드 갱신.
  - 커밋: 8bdeba5~19a46e2.
- C2 17:30~ / feature 감사 반영: MUST 4종 + SHOULD 일부 / test 82 green
  - 아웃라인(DocumentSymbol) 595f3e3
  - include 클릭이동(DocumentLink)+resolver 추출 5486b85
  - commands(팔레트) + RevalidateNow
  - 문법 ~SEQ/IP/CIDR/BOOL
  - 스니펫 4종
  - ADR-0014, CHANGELOG/README 갱신
  - 남은 MUST: publisher(사용자 자산). quality 감사 응답 대기 → 다음 P0 견고성.
