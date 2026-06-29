# 00 - Architecture Overview (아키텍처 개요)

> 전체 구조, 모듈 분리, 데이터 흐름. 상세 설계는 01~03 문서 참조.

---

## 1 설계 목표

1. **keepalived 소스 최대 활용** — 스키마를 소스에서 추출, 수작업 최소화.
2. **단일 스키마** — 파서·검증·hover·자동완성이 한 데이터를 공유.
3. **core / vscode 분리** — 검증 로직을 에디터 API에서 독립. 추후 LSP 확장 대비.
4. **과잉 설계 금지** — LSP·WASM 등 불필요한 복잡도 배제 (CLAUDE.md).

---

## 2 폴더 구조

```
keepalived-tools/
├── package.json                          # contributes: languages, grammars, commands
├── language-configuration.json           # 괄호, 주석(#, !), 폴딩
│
├── syntaxes/
│   └── keepalived.tmLanguage.json        # 하이라이팅 (S2, 일부 S1 생성)
│
├── schema/
│   └── keepalived-spec.json              # [단일 진실원] 지시어·중첩·타입·범위
│
├── tools/
│   └── extract-schema/                   # [별도 도구] keepalived 소스 → 스키마
│       └── ...                           # 익스텐션 빌드와 분리. 배포물에 미포함
│
├── core/                                 # [순수 로직] vscode import 절대 없음
│   ├── schema/                           # 스키마 로더·타입
│   ├── parser/                           # conf 텍스트 → AST
│   └── validation/                       # AST + 스키마 → Diagnostic[]
│       ├── syntax.ts                     #   구문층
│       ├── type.ts                       #   타입층
│       ├── semantic.ts                   #   의미층 (참조 무결성)
│       └── include.ts                    #   include 다중파일
│
├── vscode/                               # [얇은 어댑터]
│   ├── extension.ts                      # activate, core 호출 → DiagnosticCollection
│   ├── completion.ts                     # core 결과 → CompletionItem
│   ├── hover.ts                          # core 결과 → Hover
│   └── formatter.ts
│
└── test/                                 # core 단위 + 통합
```

---

## 3 모듈 책임 (SRP)

| 모듈 | 책임 | VSCode 의존 |
|------|------|-------------|
| `tools/extract-schema` | keepalived 소스 → 스키마 생성 (빌드 타임, 1회성) | X |
| `schema/*.json` | 지시어·타입·중첩·범위 데이터 | X |
| `core/parser` | 텍스트 → AST. 문법 구조화 | X |
| `core/validation` | AST + 스키마 → 진단 목록 (표준 데이터) | **X (핵심)** |
| `vscode/*` | core 결과를 VSCode UI로 매핑 | O |

핵심 규칙: **`core/`는 `vscode` 모듈을 import하지 않는다.** 위반 시 LSP 확장성 깨짐.

---

## 4 데이터 흐름

```
[빌드 타임 / 1회성]
keepalived 소스 ──> tools/extract-schema ──> schema/keepalived-spec.json
                                                      │
[런타임 / 파일 편집 시]                                 │ (로드)
                                                      ▼
사용자가 .conf 편집 ──> vscode/extension.ts ──> core/parser ──> AST
                                                      │            │
                                                      ▼            ▼
                                              core/validation (스키마 + AST)
                                                      │
                                                      ▼
                                           Diagnostic[] (순수 데이터)
                                                      │
                                  vscode/extension.ts (어댑터)
                                                      │
                                                      ▼
                                       VSCode DiagnosticCollection (빨간 줄)
```

- 자동완성·hover도 동일 패턴: vscode 어댑터가 core(+스키마) 호출 → 결과를 VSCode 객체로 변환.

---

## 5 LSP 확장 경로 (지금은 미구현)

현재는 `vscode/` 어댑터가 core를 감싼다. 나중에 다른 에디터가 필요하면:

```
지금:   core ──> vscode 어댑터 ──> VSCode
나중:   core ──> LSP 어댑터(server) <──JSON-RPC──> 모든 에디터
        (core 코드 한 줄도 안 바뀜)
```

- core가 순수하기 때문에 LSP 어댑터만 새로 작성하면 됨.
- 이를 위해 core는 "텍스트 in → 진단/완성/hover 데이터 out" 인터페이스만 노출.

---

## 6 언어 연결 (file association)

- 언어 ID: `keepalived`
- 파일명 `keepalived.conf`
- glob: `**/keepalived/*.conf`, `**/keepalived.conf.d/*` 등 (조사: 표준 경로 `/etc/keepalived/`)
- 확장자만으로 단정 못 하므로 파일명 + glob 병행.
