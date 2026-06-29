# ADR-0013: 정의 이동·Quick-fix 도입 (신뢰성 우선 후보 제한)

- 상태: Accepted
- 날짜: 2026-06-29

## Context

1.0 정식 릴리스에서 "Linters" 카테고리 익스텐션이 갖출 표준 UX 두 가지가 빠져 있었다:

- **정의 이동(Go to Definition)**: 스키마는 `refTo`/`defines` 로 참조-정의 관계를
  이미 모델링하고, 심볼 테이블도 있다. 그런데 점프 기능이 없었다.
- **Quick-fix(Code Action)**: 진단은 `code`/`range` 를 달고 나오지만 교정 제안이 없었다.

둘 다 로직은 core(순수)에 두고 어댑터는 얇게(ADR-0002) 유지해야 한다.

## Decision

1. core 에 순수 함수 2개 추가:
   - `definitionAt(text, line, col)`: 커서가 ref 지시어 값 위면 그 심볼을 `defines`
     하는 정의의 range 반환. 단일 파일 기준.
   - `quickFixesFor(text, code, badText, line, col)`: 진단 코드별 교정 후보.
     - `TYPE_INVALID_ENUM` → 해당 지시어 enum 값들.
     - `SYNTAX_UNKNOWN_DIRECTIVE` → 부모 블록의 지시어+자식블록(최상위면 root 블록).
2. **신뢰성 우선 후보 제한**: Levenshtein 편집거리로 근접한 후보만 제안한다.
   임계 = `min(3, max(1, floor(len/3)))`. 거리 0(동일)·임계 초과는 버린다.
   멀리 떨어진 후보를 들이밀면 잡음 → 차라리 제안 안 함(validation §1.1과 동일 철학).
3. 어댑터(`definition.ts`, `codeActions.ts`)는 core 호출 결과를 vscode 객체로 1:1 변환.
   code action 은 진단 range 텍스트를 후보로 치환하는 WorkspaceEdit 생성.

## Consequences

- (+) 표준 IDE UX 확보 — 1.0 자격.
- (+) 후보 제한으로 "엉뚱한 제안" 없음 — 신뢰성 유지.
- (+) 로직이 core 라 LSP 어댑터 재사용 가능(ADR-0002).
- (−) 정의 이동은 단일 파일 한정 — include 크로스파일 점프는 v1.x.
- (−) quick-fix 는 enum·미지시어 두 코드만 — 범위·IP 등은 자동 교정이 무의미해 제외.
