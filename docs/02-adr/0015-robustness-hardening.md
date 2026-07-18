# ADR-0015: 견고성 강화 (코드 감사 반영, 0.23.0)

- 상태: Accepted
- 날짜: 2026-06-29

## Context

코드 감사(quality-auditor, tsx 프로브로 실측 검증)에서 제품급 안정성을 막는
정확성·견고성 결함이 드러났다. 심각도순으로 일괄 수정한다.

## Decision

수정 항목(각각 재현 테스트 선행 — CLAUDE.md §6):

- **C1 중첩 include**: 어댑터가 `ast.body`(최상위)만 보고 블록 안 include 를
  무시 → cross-file 심볼 누락, 거짓 `SEMANTIC_UNDEFINED_REF`.
  core 에 재귀 `collectIncludes()` 추가, 진단·DocumentLink 공유.
- **H1 BOM**: 선두 U+FEFF 가 첫 키워드를 오염. lexer 에서 스킵.
- **H2 perf/stale**: 포함 파일을 매 키스트로크 재읽기·재파싱.
  mtime 캐시 + 열린 VSCode 버퍼 우선(다른 탭 미저장 편집 반영).
- **M1 순환 진단**: 양쪽 노드 중복 보고·혼란 메시지·entry 밖 순환 누락.
  전 노드 DFS + 닫는 엣지 1곳 보고 + 전체 경로 메시지.
- **M2 NEWLINE end**: 잘못된 off-by-one. end = 다음 줄 col 0.
- **M3 심볼 키**: 공백 구분자가 따옴표 이름과 충돌. `set\0name` 으로(주석 계약대로).
- **M4 glob**: `**` 이후 경로 구조 손실 + 심링크 순환 무방비.
  전체 경로 정규식 매칭 + realpath 방문집합으로 순환 차단.
- **L1/L2/L3**: locate 죽은 변수 제거, 빈 stub(YAGNI) 제거, parseFile start 0:0.

## Consequences

- (+) 다중 파일·Windows(BOM/CRLF)·심링크 환경에서 정확/안전.
- (+) 편집 응답성 향상(캐시), 다른 탭 편집 즉시 반영.
- (+) 회귀 테스트로 박제(BOM/CRLF/멀티바이트/중첩include/순환/NEWLINE).
- 감사가 "정상 확인"한 항목(provider guard, 멀티바이트 col, 포맷터 멱등,
  타입검사, 디바운스)은 회귀 방지 대상으로 기록.
