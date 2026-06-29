# 02 - Parser Design (파서 설계) — 재설계 v2

> `core/parser`: keepalived.conf 텍스트 → AST. VSCode 의존 없음.
> 검증·completion·hover·formatter의 공통 입력. 고급문법은 **2.3.4 샘플 실측** 기반.

---

## 1 책임

- 입력: conf 텍스트(string) + 파일 경로
- 출력: AST (블록·지시어·값 트리, 모든 노드에 위치 정보)
- **검증 안 함.** 파서는 구조화만. 판정은 `core/validation` (SRP).

분리 이유: 파서가 검증까지 하면 "구조화"+"규칙 판정" 두 책임 → SRP 위반.

---

## 2 파이프라인

```
텍스트 ─> [Lexer] ─> Token[] ─> [Parser(재귀하강)] ─> AST
                                       └─> 복구 가능한 구문오류는 ParseError[]로 수집
```

keepalived 문법은 단순(블록 + 키-값, 최대 중첩 3). 손수 작성 재귀 하강으로 충분.
ANTLR 등 파서 제너레이터 불필요 (과잉 설계, TD-1).

---

## 3 Lexer (토큰화)

| 토큰 | 예 | 비고 |
|------|-----|------|
| COMMENT | `# ...`, `! ...` | **# 와 ! 둘 다 주석.** 줄 끝까지 |
| LBRACE / RBRACE | `{` `}` | 블록. 같은 줄/다음 줄 모두 허용 |
| WORD | `vrrp_instance`, `state`, `MASTER` | 지시어·값 공통 |
| QUOTED | `"a b c"` | 인용 문자열 (공백 포함) |
| NUMBER | `100`, `2.71828` | int/timer 후보 (타입 판정은 검증층) |
| COND_PREFIX | `@high`, `@^low`, `@main` | **줄 단위 조건부 접두사** (§4) |
| VAR | `$PRIORITY` | 변수 치환 (§4) |
| SEQ | `~SEQ(1,3)` | 시퀀스 확장 (§4) |
| NEWLINE | | 지시어 구분 (keepalived는 줄 기반) |
| WS | | 공백 (토큰 사이) |

주의(실측):
- **`!` 주석**: 많은 포맷과 달라 놓치기 쉬움. Lexer에서 반드시 처리.
- **quoted 안의 `#`/`!`/`$`/`@`**: 주석·치환 아님. 리터럴.
- **`@` 는 줄 맨 앞 토큰일 때만 조건부 접두사.** 값 위치의 `@`는 일반 문자.
- keepalived는 **줄(line) 기반** 파싱(`vector_t` per line). NEWLINE을 구분자로 보존.

---

## 4 고급문법 처리 범위 (실측 + 경계 확정)

초안은 토큰만 인식하고 의미는 미정이었음. 샘플
(`doc/samples/keepalived.conf.conditional_conf`)로 실제 동작 확인 후 경계 확정.

### 4.1 `@` 조건부 접두사 (config_id 기반)

```conf
@high   priority 170      # config_id 가 high 일 때만 이 줄 활성
@low    priority 85       # config_id 가 low 일 때만
@^main  state BACKUP      # main 이 아닐 때 (부정)
```

- `@<id>` = 줄 맨 앞. 그 줄은 keepalived 실행 시 `-i <id>` 와 일치할 때만 적용.
- 파서 처리: COND_PREFIX 토큰으로 인식 → 해당 Directive/Block 노드에 `condition` 메타 부착.
- **검증 범위**: 구조만 인식. "어떤 config_id가 맞는가"는 런타임 정보라 **검증 안 함**.
  단, `@`가 붙은 줄도 정상 지시어로 파싱(빨간 줄 오탐 방지).

### 4.2 `$` 변수 치환

```conf
vrrp_instance VI_0 { priority $PRIORITY }   # $PRIORITY → 외부 정의값
```

- VAR 토큰으로 인식. Value 노드 `kind: "var"`.
- **검증 범위**: `$VAR`가 들어간 값은 **타입 검증 면제** (값을 모르므로).
  미정의 변수 경고는 v1.0 비범위(런타임 의존) → info 정도만 검토.

### 4.3 `~SEQ()` 시퀀스

```conf
real_server 10.0.0.~SEQ(1,5) 80   # 10.0.0.1 ~ 10.0.0.5 확장
```

- SEQ 토큰. Value 노드 `kind: "seq"`.
- **검증 범위**: 구조 인식만. 확장 결과 IP의 형식 검증은 면제(확장 전엔 불완전).

### 4.4 `include`

```conf
include /etc/keepalived/conf.d/*.conf
```

- 파서는 **AST 노드로 인식만** (glob 문자열 보존). 파일 확장·병합은 검증 include층(03 §6).
- 이유: 파서는 단일 파일 책임. 다중 파일 조립은 검증층 + fs(어댑터)의 일.

---

## 5 AST 노드 (재설계 — 깊이 3 반영)

```ts
// core/parser/ast.ts  (VSCode 의존 없음)

interface Position { line: number; col: number; offset: number; }
interface Range { start: Position; end: Position; }
interface Node { range: Range; }

interface ConfFile extends Node {
  body: (Block | Directive | IncludeDirective)[];   // 최상위에 지시어도 올 수 있음(global 단발)
}

interface Block extends Node {
  keyword: string;          // "vrrp_instance" | "real_server" | "HTTP_GET" ...
  args: Value[];            // 블록 헤더 인자: vrrp_instance [VI_1]
  body: (Block | Directive)[];  // 중첩(blocks) + 지시어를 순서 보존해 하나로
  condition?: string;       // @ 조건부 (4.1). 없으면 무조건
}

interface Directive extends Node {
  keyword: string;          // "state"
  values: Value[];          // [MASTER]
  condition?: string;
}

interface Value extends Node {
  raw: string;
  kind: "word" | "quoted" | "number" | "ip" | "var" | "seq";
  // kind는 lexer 수준 추정. 정밀 타입 판정은 검증 타입층.
}

interface IncludeDirective extends Node { glob: string; }
```

설계 결정:
- `body`를 Block/Directive **혼합 순서 배열**로 둠 (초안은 directives/subBlocks 분리).
  이유: 포맷터·completion이 원본 순서를 보존해야 함. 종류 구분은 `keyword`로.
- 모든 노드에 `Range` 필수 — 진단을 정확한 줄/칸에 찍기 위해.
- 깊이 제한 없음(재귀). 실제 깊이 3이지만 하드코딩 안 함.

---

## 6 오류 복구 (error recovery)

편집 중 파일은 항상 불완전 → 첫 오류에서 멈추면 안 됨.

| 상황 | 복구 |
|------|------|
| 짝 안 맞는 `{` | 블록 경계 추정(다음 root 키워드/EOF까지), ParseError 수집, 계속 |
| 짝 안 맞는 `}` | 현재 블록 닫고 ParseError 수집, 계속 |
| 알 수 없는 토큰 | 스킵 + ParseError, 계속 |
| 미완성 줄(값 없음) | Directive 노드는 만들되 values=[] (타입층이 "필수값 누락" 판정) |

목표: 부분적으로 깨진 파일에서도 **최대한 AST를 만들어** completion·hover가 동작.
ParseError[]는 검증 구문층으로 전달돼 Diagnostic이 됨.

---

## 7 테스트 (S3) — CLAUDE.md 테스트 컨벤션 (AAA, 행동 검증)

| 분류 | 케이스 |
|------|--------|
| 토큰 | `#` 주석, `!` 주석, quoted 안 `#`, NUMBER 소수, QUOTED 공백 |
| 고급문법 | `@high` 접두사, `$VAR` 값, `~SEQ()`, include glob |
| 중첩 | 깊이 1/2/3 (vrrp_script / authentication / HTTP_GET>url) |
| 복구 | `{` 누락, `}` 과잉, 미완성 줄, 미지토큰 |
| 픽스처 | 실제 `doc/samples/*.conf` + 의도적 오류 샘플 |

- 픽스처는 keepalived 레포 `doc/samples/` 실제 예제 활용 (운영 데이터 미사용).
- flaky 제로 톨러런스, 순서 무관, 시간/난수 의존 없음.
