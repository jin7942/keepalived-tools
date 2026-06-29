# 03 - Validation Design (검증 설계)

> `core/validation`: AST + 스키마 → Diagnostic[].
> 4개 층을 순차 적용. 각 층은 독립 모듈 (SRP). VSCode 의존 없음.

---

## 1 진단 데이터 형식 (순수)

```ts
// core/validation/diagnostic.ts  (VSCode 의존 없음)

type Severity = "error" | "warning" | "info";

interface Diagnostic {
  range: Range;          // 파서 AST의 위치 정보 재사용
  severity: Severity;
  code: string;          // 에러 코드 (CLAUDE.md 에러코드 체계)
  message: string;       // 사람이 읽는 메시지
}
```

- vscode 어댑터가 이 데이터를 `vscode.Diagnostic`으로 1:1 변환.
- 에러 코드 체계: `<도메인>_<상태>` 형식 (예: `SYNTAX_UNKNOWN_DIRECTIVE`, `TYPE_OUT_OF_RANGE`).

---

## 2 4개 검증 층

순차 적용. 앞 층 통과해야 뒤 층이 의미 있음 (구문 깨지면 타입 검사 무의미).

| 층 | 모듈 | 입력 | 판정 |
|----|------|------|------|
| 1 구문 | `syntax.ts` | AST + 스키마 | 구조 정합성 |
| 2 타입 | `type.ts` | AST + 스키마 | 값 정합성 |
| 3 의미 | `semantic.ts` | AST + 스키마 + 심볼테이블 | 참조 정합성 |
| 4 include | `include.ts` | 다중 AST | 파일 간 정합성 |

---

## 3 층 1: 구문 검증 (syntax.ts)

| 검사 | 진단 | 코드 |
|------|------|------|
| 괄호 짝 불일치 | error | `SYNTAX_UNBALANCED_BRACE` |
| 알 수 없는 지시어 | error | `SYNTAX_UNKNOWN_DIRECTIVE` |
| 잘못된 블록 중첩 | error | `SYNTAX_INVALID_NESTING` |
| 블록이어야 할 게 지시어로 쓰임 (또는 반대) | error | `SYNTAX_WRONG_KIND` |

- 중첩 판정: 스키마의 `subBlocks`로 "이 블록이 부모로 허용되는가" 검사.
  - 예: `real_server`는 `virtual_server`의 subBlocks에만 존재 → 다른 곳에 오면 `SYNTAX_INVALID_NESTING`.

---

## 4 층 2: 타입 검증 (type.ts)

스키마의 `type`/`min`/`max`/`values`로 값 검사.

| 검사 | 진단 | 코드 |
|------|------|------|
| 타입 불일치 (int 자리에 문자열) | error | `TYPE_MISMATCH` |
| 범위 초과 (priority=300) | error | `TYPE_OUT_OF_RANGE` |
| enum 위반 (state=PRIMARY) | error | `TYPE_INVALID_ENUM` |
| IP 형식 오류 | error | `TYPE_INVALID_IP` |
| 포트 범위 (>65535) | error | `TYPE_INVALID_PORT` |
| bool 토큰 오류 | error | `TYPE_INVALID_BOOL` |

- enum 위반 시 메시지에 허용값 나열 (예: "expected one of MASTER, BACKUP").
- 타입별 검사기는 스키마 `type` 어휘(`01-schema.md` §2.1)와 1:1.

---

## 5 층 3: 의미 검증 (semantic.ts)

블록 간 참조 무결성. **제품의 핵심 차별점.**

### 5.1 심볼 테이블

먼저 전체 AST를 훑어 정의된 이름을 수집:

```ts
interface SymbolTable {
  vrrp_scripts: Set<string>;     // 정의된 vrrp_script 이름들
  vrrp_instances: Set<string>;
  virtual_server_groups: Set<string>;
  // ...
}
```

### 5.2 참조 검사

스키마에서 `type: "ref"` 인 지시어를 심볼 테이블과 대조.

| 검사 | 진단 | 코드 |
|------|------|------|
| track_script가 없는 vrrp_script 참조 | error | `SEMANTIC_UNDEFINED_REF` |
| 중복 정의 (같은 router_id 2회 등) | warning | `SEMANTIC_DUPLICATE` |
| 정의됐으나 미참조 (선택적) | info | `SEMANTIC_UNUSED` |

- `ref`의 `refTo` 필드(`01-schema.md`)로 "어느 심볼 집합을 봐야 하는지" 결정.

---

## 6 층 4: include 다중파일 (include.ts)

### 6.1 문제

keepalived `include /etc/keepalived/*.conf`는 여러 파일을 하나의 설정으로 합친다.
참조(layer 3)가 **다른 파일에 정의된** vrrp_script를 가리킬 수 있음.

### 6.2 처리

```
진입 파일 ──> include glob 해석 ──> 관련 .conf 목록
                                        │
                                        ▼
              각 파일 파싱 ──> AST들 ──> 가상 병합 (merged symbol table)
                                        │
                                        ▼
                       layer 3 의미 검증을 병합된 심볼 테이블로 수행
```

- glob/brace 확장은 워크스페이스 파일 시스템 기준 (vscode 어댑터가 파일 목록 제공, core는 순수 입력만 받음).
- 순환 include 감지 (A include B, B include A) → `INCLUDE_CYCLE` 진단.
- 파일 못 찾음 → `INCLUDE_NOT_FOUND` warning.

### 6.3 core 순수성 유지

- core는 파일 시스템을 직접 안 건드림.
- vscode 어댑터가 "이 glob에 해당하는 파일 텍스트들"을 읽어 core에 넘김.
- 이유: core가 fs에 의존하면 테스트·LSP 이식이 어려워짐. 파일 읽기는 어댑터 책임.

---

## 7 성능

- 편집 중 매 키 입력마다 전체 재검증은 비쌈 → debounce (어댑터 레벨).
- 단일 파일 검증은 동기로 충분 (작은 파일). include 다중파일만 비용 큼 → 필요 시 캐시.
- 과한 최적화는 측정 후 (CLAUDE.md: 안정성 > 성능, 조기 최적화 금지).

---

## 8 테스트 (S4-S7)

각 층·각 진단 코드별 케이스 (CLAUDE.md 테스트 컨벤션):

| 층 | 테스트 케이스 |
|----|--------------|
| 구문 | 괄호 깨짐, 미지시어, real_server 오배치 |
| 타입 | priority 범위, state enum, IP 형식 |
| 의미 | 미정의 track_script 참조, 중복 router_id |
| include | 크로스파일 참조, 순환 include, 파일 누락 |

- 픽스처: 정상 conf + 각 오류 유형 샘플. 운영 데이터 미사용.
