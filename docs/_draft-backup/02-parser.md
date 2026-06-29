# 02 - Parser Design (파서 설계)

> `core/parser`: keepalived.conf 텍스트 → AST.
> 검증·자동완성·hover·포맷터의 공통 입력을 만든다. VSCode 의존 없음.

---

## 1 책임

- 입력: conf 파일 텍스트(string) + 파일 경로
- 출력: AST (블록·지시어·값의 트리, 각 노드에 위치 정보)
- **검증은 안 함.** 파서는 구조화만. 판정은 `core/validation`이.

분리 이유 (SRP): 파서가 검증까지 하면 "구조화"와 "규칙 판정" 두 책임 → 단일 책임 위반.

---

## 2 파이프라인

```
텍스트 ──> [Lexer] ──> Token[] ──> [Parser] ──> AST
                                              └─> 복구 가능한 구문오류는 진단으로 수집
```

keepalived 문법은 단순(블록 + 키-값)하므로 손수 작성한 재귀 하강 파서로 충분.
파서 제너레이터(ANTLR 등) 불필요 — 과잉 설계.

---

## 3 Lexer (토큰화)

keepalived 문법 토큰:

| 토큰 | 예 | 비고 |
|------|-----|------|
| COMMENT | `# ...`, `! ...` | **#와 ! 둘 다** 주석. 줄 끝까지 |
| LBRACE / RBRACE | `{` `}` | 블록 |
| WORD | `vrrp_instance`, `state` | 지시어·값 공통 |
| QUOTED | `"a b c"` | 인용 문자열 (공백 포함) |
| NUMBER | `100`, `2.71828` | int/timer |
| INCLUDE | `include` | glob 처리 트리거 |
| VAR | `$VAR` | 변수 치환 (고급) |
| COND | `@host` | 조건부 (고급) |
| SEQ | `~SEQ(...)` | 시퀀스 (고급) |
| NEWLINE / WS | | 구분자 |

주의:
- `!` 주석: 많은 포맷과 달라 놓치기 쉬움. Lexer에서 반드시 처리.
- quoted 안의 `#`/`!`는 주석 아님.

---

## 4 AST 노드 (초안)

```ts
// core/parser/ast.ts  (VSCode 의존 없음)

interface Position { line: number; col: number; offset: number; }
interface Range { start: Position; end: Position; }

interface Node { range: Range; }

interface ConfFile extends Node {
  blocks: Block[];
  includes: IncludeDirective[];
}

interface Block extends Node {
  keyword: string;          // "vrrp_instance"
  args: Value[];            // 블록 헤더 인자 (vrrp_instance VI_1)
  directives: Directive[];
  subBlocks: Block[];       // 중첩
}

interface Directive extends Node {
  keyword: string;          // "state"
  values: Value[];          // ["MASTER"]
}

interface Value extends Node {
  raw: string;
  kind: "word" | "quoted" | "number" | "var" | "seq";
}

interface IncludeDirective extends Node {
  glob: string;             // "/etc/keepalived/*.conf"
}
```

위치 정보(`Range`)는 모든 노드에 필수 — 검증이 진단을 정확한 줄/칸에 찍으려면.

---

## 5 오류 복구 (error recovery)

- 파서는 첫 오류에서 멈추지 않는다. 편집 중 파일은 항상 불완전하므로.
- 복구 전략:
  - 짝 안 맞는 `{` `}`: 블록 경계 추정 후 진단 수집, 계속 파싱.
  - 알 수 없는 토큰: 스킵하고 진단 수집.
- 목표: 부분적으로 깨진 파일에서도 최대한 AST를 만들어 자동완성·hover가 동작하도록.

---

## 6 include 처리 (파서 레벨)

- 파서는 `include` 지시어를 **AST 노드로 인식만** 한다 (glob 문자열 보존).
- 실제 파일 확장·병합은 `core/validation/include.ts`가 담당 (`03-validation.md`).
- 이유: 파서는 단일 파일 책임. 다중 파일 조립은 검증 층의 일.

---

## 7 테스트 (S3)

- 단위 테스트: 각 토큰·노드 종류별 파싱 (CLAUDE.md 테스트 컨벤션 AAA).
- 경계 케이스: `!` 주석, quoted 안 `#`, 중첩 블록, 깨진 괄호 복구.
- 픽스처: 실제 keepalived.conf 예제 + 의도적 오류 샘플.
