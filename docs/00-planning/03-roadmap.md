# 03 - Roadmap (로드맵)

> v1.0은 풀기능 출시가 목표. 단계는 "출시 단위"가 아니라 **내부 개발 순서**다.
> 공개는 v1.0에서 한 번에.

---

## 1 출시 전략

- **풀기능 v1.0 일괄 공개.** MVP 단계 출시 아님.
- 아래 단계는 내부 개발 순서일 뿐, 각 단계마다 마켓 배포하지 않음.
- 버전 규칙은 사내 표준 SemVer (CLAUDE.md `[REQUIRED]`).

---

## 2 v1.0 내부 개발 단계

의존성 순서대로 쌓는다. 앞 단계가 뒤 단계의 토대.

| 단계 | 산출물 | 의존 |
|------|--------|------|
| S0 | 프로젝트 셋업 (package.json, 빌드, contributes 골격) | — |
| S1 | **스키마 추출 도구** (`tools/extract-schema`) → `spec.json` + `overrides.json` → `merged.json` | keepalived 소스 |
| S2 | **Syntax Highlighting** (tmLanguage + language-configuration) | S1 (지시어 목록) |
| S3 | **Parser** (`core/parser`: conf → AST) | S1 |
| S4 | **Validation 구문층** (괄호/미지시어/중첩) | S3, S1 |
| S5 | **Validation 타입층** (범위/enum/타입) | S4, S1 |
| S6 | **Validation 의미층** (참조 무결성) | S5 |
| S7 | **include 다중파일 해석** | S6 |
| S8 | **Hover** (지시어 문서) | S1 |
| S9 | **Completion** (블록/지시어/enum) | S1, S3 |
| S10 | **Snippets** | S1 |
| S11 | **Formatter** | S3 |
| S12 | VSCode 어댑터 통합 (`vscode/extension.ts`) | S2-S11 |
| S13 | 테스트 (core 단위 + 통합) | 전체 |
| S14 | 패키징·배포 준비 (vsce, LICENSE, README) | 전체 |

핵심 경로: **S1(스키마)** 가 거의 모든 단계의 토대. 여기 먼저 투자.

> S1 난이도 보정 (소스 실측 후): 추출은 단순 정규식이 아니라 **콜그래프 추적 + 상수 해석 + override 레이어**가 필요.
> 상세·근거는 `01-architecture/01-schema.md` §4. S1을 다음 하위 단계로 분해:
> - S1a 콜그래프 추적(블록/중첩/이름) → S1b 핸들러 타입 추론(범위/enum배열) → S1c 상수 해석 → S1d override 작성(strcmp enum 등) → S1e merge.

---

## 3 v1.x 후속 (v1.0 제외 항목)

현재 v1.0 범위에 다 넣기로 했으므로 후속은 비어 있음.
추후 필요 시 검토 대상:

| 후보 | 비고 |
|------|------|
| LSP 어댑터 추가 | 다른 에디터 지원 요구 생기면 (core 재사용) |
| keepalived 버전별 스키마 분기 | 사용자가 버전 선택 |
| Code Actions (quick fix) | 검증 오류 자동 수정 제안 |

---

## 4 배포 주의 (조사 기반)

- VSCode 마켓플레이스 publisher 계정 필요 (현재 미보유, 배포 시점에 준비).
- 전역 PAT가 **2026-12-01 폐지 예정** → Entra ID 기반 게시 경로 고려.
- 상세 배포 절차는 S14 단계에서 문서화.
