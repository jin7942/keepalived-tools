# 03 - Validation Design (검증 설계) — 재설계 v2

> `core/validation`: AST + 스키마 → Diagnostic[]. 4층 순차. 각 층 독립 모듈(SRP).
> VSCode 의존 없음. **신뢰성 우선**: 확실한 것만 error, 불확실하면 warning/info/침묵.

---

## 1 진단 데이터 형식 (순수)

```ts
// core/validation/diagnostic.ts  (VSCode 의존 없음)

type Severity = "error" | "warning" | "info";

interface Diagnostic {
  range: Range;          // 파서 AST 위치 재사용
  severity: Severity;
  code: string;          // 에러 코드 (CLAUDE.md 에러코드 체계)
  message: string;       // 사람이 읽는 메시지 (친절·명확)
  related?: { range: Range; message: string }[];  // 연관 위치 (예: 중복의 원본 정의)
}
```

- vscode 어댑터가 `vscode.Diagnostic`으로 1:1 변환. `related`→`relatedInformation`.
- 에러 코드: `<도메인>_<상태>` (예: `SYNTAX_UNKNOWN_DIRECTIVE`, `TYPE_OUT_OF_RANGE`).

### 1.1 severity 정책 (CLAUDE.md 안정성 우선)

| 확신도 | severity | 예 |
|--------|----------|-----|
| 스키마로 100% 단정 | error | 미지시어, 범위 초과, enum 위반, 괄호 짝 |
| 정황상 의심이나 합법 가능 | warning | 미참조 정의, 중복(덮어쓰기 의도일 수도) |
| 참고 정보 | info | deprecated 사용, alias 사용 |
| 모르면 | 침묵 | `$VAR` 값, `@조건부` 분기, `~SEQ` 확장값 |

**오탐 1건이 신뢰 10건을 깎는다.** 애매하면 낮추거나 안 띄운다.

---

## 2 4개 검증 층

순차 적용. 앞 층 깨지면 뒤 층 무의미.

| 층 | 모듈 | 입력 | 판정 |
|----|------|------|------|
| 1 구문 | `syntax.ts` | AST + ParseError + 스키마 | 구조 정합성 |
| 2 타입 | `type.ts` | AST + 스키마 | 값 정합성 |
| 3 의미 | `semantic.ts` | AST + 스키마 + 심볼테이블 | 참조·필수·중복 |
| 4 include | `include.ts` | 다중 AST | 파일 간 정합성 |

**alias 정규화는 전 층 진입 전 1회**: AST의 `keyword`가 `aliasOf`면 canonical로 치환
(스키마 §3.4). 이후 모든 층은 canonical만 본다.

---

## 3 층 1: 구문 검증 (syntax.ts)

| 검사 | severity | 코드 |
|------|:---:|------|
| 괄호 짝 불일치 (ParseError 승계) | error | `SYNTAX_UNBALANCED_BRACE` |
| 알 수 없는 지시어 | error | `SYNTAX_UNKNOWN_DIRECTIVE` |
| 잘못된 부모 블록 | error | `SYNTAX_INVALID_PARENT` |
| 블록↔지시어 종류 오용 | error | `SYNTAX_WRONG_KIND` |
| 미완성 줄(필수 형태 깨짐) | error | `SYNTAX_INCOMPLETE` |

- **부모 검사**: 스키마 `validParents` 로 판정.
  예: `real_server`의 validParents=["virtual_server"] → 다른 곳에 오면 `SYNTAX_INVALID_PARENT`.
- **미지시어 판정 주의**: 조건부 컴파일 키워드도 스키마에 최대집합으로 있음(overview §7)
  → 정상으로 인정. 진짜 모르는 것만 error.
- ParseError[](파서 복구분)는 여기서 Diagnostic으로 변환.

---

## 4 층 2: 타입 검증 (type.ts)

스키마 `type`/`min`/`max`/`values`로 값 검사. 타입별 검사기는 스키마 어휘(01 §3.1)와 1:1.

| 검사 | severity | 코드 |
|------|:---:|------|
| 타입 불일치 (int 자리 문자열) | error | `TYPE_MISMATCH` |
| 범위 초과 (priority=300) | error | `TYPE_OUT_OF_RANGE` |
| enum 위반 (state=PRIMARY) | error | `TYPE_INVALID_ENUM` |
| IP 형식 오류 | error | `TYPE_INVALID_IP` |
| CIDR prefix 범위 (>32 / >128) | error | `TYPE_INVALID_CIDR` |
| 포트 범위 (>65535) | error | `TYPE_INVALID_PORT` |
| bool 토큰 오류 | error | `TYPE_INVALID_BOOL` |

규칙(실측 반영):
- enum 위반 메시지에 허용값 나열 ("expected one of MASTER, BACKUP").
- `caseInsensitive` enum(protocol 등)은 대소문자 무시 비교(strcasecmp 모방).
- **검증 면제**: 값이 `$VAR`/`~SEQ`/`@`조건부면 타입 검사 스킵 (파서 §4, severity 정책 §1.1).
- bool 허용 토큰 = on/off/true/false/yes/no (check_true_false 실측).

---

## 5 층 3: 의미 검증 (semantic.ts) — 제품 핵심 차별점

블록 간 참조 무결성 + 필수/중복. **단순 하이라이터가 못 하는 영역.**

### 5.1 심볼 테이블

전체 AST(+include 병합분)를 훑어 정의된 이름 수집. 스키마 `defines` 필드로 집합 결정.

```ts
interface SymbolTable {
  // key = 스키마 defines 값, value = 정의 위치들
  [symbol: string]: { name: string; range: Range }[];
}
// 예: vrrp_scripts, vrrp_instances, virtual_server_groups, track_files, bfd_instances
```

### 5.2 검사

| 검사 | severity | 코드 |
|------|:---:|------|
| `ref`가 미정의 심볼 참조 | error | `SEMANTIC_UNDEFINED_REF` |
| 필수 지시어 누락 (required) | error | `SEMANTIC_MISSING_REQUIRED` |
| maxOccurs 위반 (블록당 1회 지시어 2회) | warning | `SEMANTIC_DUPLICATE_DIRECTIVE` |
| 같은 이름 블록 중복 정의 | warning | `SEMANTIC_DUPLICATE_DEFINITION` |
| 정의됐으나 미참조 | info | `SEMANTIC_UNUSED` |
| deprecated 키워드 사용 (vrrp_track_file 등) | info | `SEMANTIC_DEPRECATED` |

규칙:
- `ref`의 `refTo`(스키마)로 어느 심볼 집합을 볼지 결정.
  예: `track_script` refTo=`vrrp_scripts` → 그 집합에 있는지 검사.
- 중복을 **error 아닌 warning**: keepalived가 덮어쓰기 허용하는 경우 있음 → 오탐 방지(§1.1).
- 미참조/deprecated는 info: 합법이나 알려주면 유용.
- `related`로 중복의 원본 위치를 가리켜 사용자가 점프 가능.

### 5.3 v1.0 의미검증 경계

- **하는 것**: ref 존재, required 누락, 중복, deprecated.
- **안 하는 것(v1.0 비범위)**: 복잡한 상호의존("state MASTER면 priority>X"),
  상호배타 조합 전수, 런타임 의존 제약. 근거: 오탐 위험 + 도메인 깊이.
  필요 시 v1.x에서 스키마 제약 어휘 확장 후 추가.

---

## 6 층 4: include 다중파일 (include.ts)

### 6.1 문제

`include /etc/keepalived/conf.d/*.conf`는 여러 파일을 하나의 설정으로 합침.
참조(층3)가 **다른 파일 정의**를 가리킬 수 있음.

### 6.2 처리

```
진입 파일 ─> include glob 목록 ─┐
                                 ├─> (어댑터가 fs로 파일 텍스트 제공) ─> 각 파싱 ─> AST들
                                 │
       가상 병합(merged symbol table) ─> 층3 의미검증을 병합 심볼로 재수행
```

| 검사 | severity | 코드 |
|------|:---:|------|
| 순환 include (A↔B) | error | `INCLUDE_CYCLE` |
| include 파일 못 찾음 | warning | `INCLUDE_NOT_FOUND` |
| 크로스파일 미정의 참조 | error | `SEMANTIC_UNDEFINED_REF` (병합 후 층3) |

### 6.3 core 순수성 유지 (중요)

- **core는 fs를 직접 안 건드림.** glob 해석·파일 읽기는 **vscode 어댑터**가 수행해
  "glob → 파일 텍스트 배열"을 core에 넘김.
- 이유: core가 fs 의존하면 테스트·LSP 이식이 어려워짐. core 인터페이스:
  `validate(files: {path, text}[], entryPath): Diagnostic[]`.
- 순환 감지는 core가 include 그래프로 수행(텍스트만으로 가능).

---

## 7 성능 (조기 최적화 금지 — CLAUDE.md)

- 편집 중 매 키 입력 전체 재검증은 비쌈 → **debounce는 어댑터 레벨**(예: 300ms).
- 단일 파일 검증은 동기로 충분(작은 파일). include 다중파일만 비용 큼.
- 캐시·증분 파싱은 **측정 후** 도입. 안정성 > 성능.

---

## 8 테스트 (S4-S7) — CLAUDE.md 테스트 컨벤션

| 층 | 케이스 |
|----|--------|
| 구문 | 괄호 깨짐, 미지시어, real_server 오배치(validParents), 깊이3 |
| 타입 | priority 범위, state enum, protocol 대소문자, IP/CIDR, bool, $VAR 면제 |
| 의미 | 미정의 track_script, 필수 누락, maxOccurs 중복, deprecated, 미참조 |
| include | 크로스파일 참조, 순환, 파일 누락, 병합 심볼 |
| alias | lvs_sched/lb_algo 정규화 후 동일 처리 |

- 각 진단 코드별 최소 1 케이스. 행동(입력→진단) 검증, 구현 디테일 비검증.
- 픽스처: 정상 conf + 오류 유형별 샘플 (`doc/samples/` 활용 + 자작 오류).
- severity 회귀 테스트: 오탐 방지가 핵심 가치 → "정상인데 진단 안 뜸" 케이스 다수 포함.
