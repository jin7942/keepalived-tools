# 00 - Architecture Overview (아키텍처 개요) — 재설계 v2

> 전면 재설계. 초안(`docs/_draft-backup/`)은 폐기, 본 문서가 기준.
> keepalived **2.3.4 소스 직접 검증** 기반 (이전 초안은 미검증 조사였음).
> 전체 구조·모듈 분리·데이터 흐름. 상세는 01(schema)/02(parser)/03(validation).

---

## 0 재설계 근거 (초안 대비 변경점)

소스를 실제 clone(`acassen/keepalived` v2.3.4)해서 추출 전제를 실측한 결과,
초안의 사실 오류와 누락을 바로잡았다.

| 항목 | 초안 | 실측(2.3.4) | 영향 |
|------|------|-------------|------|
| 등록 파일 수 | 5개 | **17개** | 추출기 스캔 대상 확대 |
| install 함수 종류 | 4종 | **5종** (`install_keyword_conditional` 누락) | 조건부 키워드 처리 필요 |
| 존재하지 않는 파일 명시 | `bfd_parser.c`(check), `vrrp_ip_rule_route_parser.c` | 실제 경로 다름 | 경로 수정 |
| 최대 중첩 깊이 | 2 (암묵) | **3** (`virtual_server>real_server>HTTP_GET>url`) | AST·스키마 깊이 보정 |
| 헬스체커 등록 | 미언급 | **크로스파일 콜그래프** | 추출기 = 정규식 불가, 콜그래프 추적 필요 |
| 타입 추출 가능성 | "반자동, 자동 불가" | **범위는 콜사이트 인자로 추출 가능 (~70-80%)** | 추출 전략 재정의 |
| 별칭(alias) | 미언급 | `lvs_sched`=`lb_algo` 등 (공유 핸들러) | 스키마 alias 모델 필요 |

상세 사실 근거는 각 하위 문서에 file:line 으로 박제.

---

## 1 설계 목표 (우선순위 순)

1. **신뢰성 우선** (CLAUDE.md: 안정성 > 확장성 > 성능 > 기능).
   오탐(false positive) 진단은 제품 신뢰를 깎으므로, **확실한 것만 error, 불확실하면 warning/info 또는 침묵.**
2. **단일 스키마** — 파서·검증·hover·completion이 `keepalived-spec.json` 하나를 공유 (TD-5).
3. **core / vscode 분리** — 검증 로직은 VSCode API에서 독립한 순수 모듈. 추후 LSP 어댑터로 감쌀 수 있게 (TD-2, DIP).
4. **추출 자동화 + override 레이어** — 자동 추출분과 수작업 보정분을 **물리적으로 분리**해, 재추출이 보정분을 덮지 않게 한다 (초안 미해결 사항 확정).
5. **과잉 설계 금지** — LSP·WASM·파서 제너레이터 배제 (TD-1, TD-2).

---

## 2 폴더 구조

```
keepalived-tools/
├── package.json                    # contributes: languages, grammars, commands
├── language-configuration.json     # 괄호, 주석(#, !), 폴딩
│
├── syntaxes/
│   └── keepalived.tmLanguage.json  # 하이라이팅 (S2)
│
├── schema/
│   ├── keepalived-spec.json        # [생성물] 자동추출 결과 (덮어쓰기됨)
│   ├── overrides.json              # [수작업] 보정 레이어 (재추출이 안 건드림)
│   └── keepalived-spec.merged.json # [빌드 산출] spec + overrides 병합 (런타임 로드 대상)
│
├── tools/
│   └── extract-schema/             # [별도 도구] keepalived 소스 → keepalived-spec.json
│       │                           #   배포물 미포함. 빌드 타임 전용.
│       ├── walk-registration.ts    #   install_keyword* 콜그래프 추적 → 블록/중첩/이름
│       ├── infer-types.ts          #   핸들러 분석 → 타입/범위 (read_* 콜사이트)
│       ├── resolve-consts.ts       #   #define 심볼 테이블 (VRRP_PRIO_OWNER→255)
│       └── merge-overrides.ts      #   spec + overrides → merged
│
├── core/                           # [순수 로직] vscode import 절대 금지
│   ├── schema/                     #   merged 스키마 로더 + 타입 정의
│   ├── parser/                     #   conf 텍스트 → AST (lexer + recursive descent)
│   └── validation/                 #   AST + 스키마 → Diagnostic[]
│       ├── syntax.ts               #     층1 구문
│       ├── type.ts                 #     층2 타입
│       ├── semantic.ts             #     층3 의미 (참조 무결성)
│       └── include.ts              #     층4 include 다중파일
│
├── vscode/                         # [얇은 어댑터] core 결과 → VSCode 객체
│   ├── extension.ts                #   activate, fs 읽기, DiagnosticCollection
│   ├── completion.ts
│   ├── hover.ts
│   └── formatter.ts
│
└── test/                           # core 단위 + 통합 (fixtures: 실제 conf + 오류 샘플)
```

핵심 규칙: **`core/`는 `vscode`를 import하지 않는다.** 위반 시 LSP 확장성 깨짐(§5).
파일 시스템 접근(include glob 해석, 워크스페이스 파일 읽기)은 **vscode 어댑터 책임** — core는 텍스트만 받는다.

---

## 3 모듈 책임 (SRP)

| 모듈 | 책임 | VSCode 의존 | fs 의존 |
|------|------|:---:|:---:|
| `tools/extract-schema` | keepalived 소스 → spec.json (1회성) | X | O (소스 읽기) |
| `schema/*.json` | 지시어·타입·중첩·범위·참조 데이터 | X | X |
| `core/parser` | 텍스트 → AST | X | X |
| `core/validation` | AST + 스키마 → Diagnostic[] | **X (핵심)** | X |
| `vscode/*` | core 호출, fs 읽기, 결과를 UI로 매핑 | O | O |

---

## 4 데이터 흐름

```
[빌드 타임 / 1회성]
keepalived 소스 ─> extract-schema ─> keepalived-spec.json ─┐
                  (콜그래프+타입추론)                        ├─ merge ─> spec.merged.json
                                          overrides.json ──┘            (런타임 로드)
                                          (수작업 보정)

[런타임 / .conf 편집 시]
사용자 편집 ─> vscode/extension.ts ─> core/parser ─> AST ─┐
                  │  (debounce)                            ├─> core/validation(스키마+AST)
                  │                                        │         │
   include 시: 어댑터가 glob 해석 ─> 파일 텍스트들 ────────┘    Diagnostic[] (순수 데이터)
                                                                     │
                                              vscode/extension.ts (1:1 매핑)
                                                                     ▼
                                                    DiagnosticCollection (빨간 줄)
```

- completion·hover도 동일: vscode 어댑터가 core(+스키마) 호출 → 결과를 VSCode 객체로 변환.

---

## 5 LSP 확장 경로 (지금 미구현, 여지만 확보)

```
지금:   core ──> vscode 어댑터 ──> VSCode
나중:   core ──> LSP 어댑터(server) <──JSON-RPC──> 모든 에디터  (core 한 줄도 안 바뀜)
```

이를 위해 core는 "텍스트 in → 진단/완성/hover 데이터 out" 인터페이스만 노출.
core가 순수해야 LSP 어댑터만 새로 쓰면 됨.

---

## 6 언어 연결 (file association)

- 언어 ID: `keepalived`
- 파일명: `keepalived.conf`
- glob: `**/keepalived/*.conf`, `**/keepalived.conf.d/**`, `**/conf.d/*.conf`(주의: 과탐 위험 → 최종 목록 S0/S2 확정)
- 표준 경로 `/etc/keepalived/` (조사 확인). 확장자만으론 단정 불가 → 파일명 + glob 병행.

---

## 7 keepalived 버전 정책 (초안 미해결 → 확정)

- 추출 기준 버전: **최신 stable (현재 2.3.4)**. spec.json `version` 필드에 박제.
- 버전별 분기는 v1.0 비범위. v1.x 후보(로드맵 §3).
- 조건부 컴파일(`#ifdef`)로 빌드 옵션에 따라 달라지는 키워드는 **최대 집합(모두 포함)**으로 추출.
  근거: 에디터는 어떤 빌드인지 모름. 빠뜨려서 "미지시어" 오탐 내는 것보다, 다 인정하는 게 안전(신뢰성 우선 §1).
