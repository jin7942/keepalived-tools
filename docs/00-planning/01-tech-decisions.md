# 01 - Tech Decisions (기술 결정)

> 기획 단계에서 합의된 기술 결정과 그 근거를 박제한다.
> 결정을 뒤집으려면 이 문서의 근거부터 반박할 것.

---

## TD-1: 언어 = TypeScript 단일

### 결정
익스텐션 본체와 검증 엔진(`core`) 모두 TypeScript.

### 근거
- 익스텐션 본체는 VSCode가 Node.js + JS 런타임으로 로드 → TS/JS **강제**. 선택지 없음.
- 검증 엔진은 이론상 WASM(Rust/Go 등) 가능하나:
  - keepalived 설정은 작은 텍스트 → TS 파서로 성능 충분
  - WASM 빼면 빌드·번들·디버깅 복잡도 폭증 (과잉 설계)
  - 단일 언어면 client ↔ core 타입 공유, 유지보수 단순
- keepalived 소스 활용은 "C 코드 번들"이 아니라 "사실 추출 후 TS 재구현" → C가 끼어들 일 없음.

### 기각된 대안
- Rust/Go 서버 + WASM: 성능 이득 미미, 복잡도만 증가.

---

## TD-2: LSP 미채택 (내부 로직 방식)

### 결정
Language Server Protocol을 v1.0에 도입하지 않는다.
검증은 VSCode 내부 API(`DiagnosticCollection` 등)로 처리.

### 근거
- LSP는 "기능"이 아니라 "구조 선택"이다. 검증 능력 자체는 내부 로직과 동일.
- LSP의 유일한 실익 = 다른 에디터(Neovim/IntelliJ) 재사용. 현재 VSCode 단독이라 실익 없음.
- LSP는 별도 프로세스 + JSON-RPC 셋업 → 불필요한 복잡도.

### 확장성 확보 (중요)
- 검증/파싱 로직을 VSCode API에서 분리한 **순수 `core` 모듈**로 작성.
- 나중에 다른 에디터가 필요해지면 같은 core를 **LSP 어댑터로 감싸기만** 하면 됨. core 코드 불변.
- 이는 CLAUDE.md의 DIP/SRP 원칙. 상세는 `01-architecture/00-overview.md`.

---

## TD-3: keepalived 소스 최대 활용 (스키마 자동 추출)

### 결정
keepalived 소스의 키워드 등록 구조를 정적 파싱하여 스키마를 자동 생성한다.

### 근거 (조사로 확인)
- keepalived 키워드 등록이 규칙적: `install_keyword_root()` / `install_keyword()` 호출로
  지시어·소속 블록이 코드에 명시됨.
- 등록 위치: `keepalived/{vrrp,check,bfd,core}/*_parser.c` (블록별 분리).
- 키워드 구조체: `lib/parser.h`의 `keyword_t` (string, handler, sub 벡터=중첩).

### 추출 방식 = 정적 파싱 + 타입 보정
| 추출 대상 | 방식 |
|-----------|------|
| 지시어 이름 + 소속 블록 + 중첩 | **자동** (단, 콜그래프 추적 필요 — 단순 정규식 아님) |
| 값 타입 (int/timer/port/ip/cidr/bool/enum배열) | **자동** (핸들러 read_* 콜사이트 인자 + 상수해석) |
| 값 타입 (strcmp enum / #ifdef enum / 의미제약) | **수작업** (overrides.json) |

> 소스 실측 보정(2.3.4): 초안의 "값 타입은 반자동, 자동 불가"는 부정확.
> 범위(min/max)는 `read_*_strvec()` **콜사이트 인자**로 전달돼 자동 추출 가능(~70-80%).
> 단 strcmp 체인 enum(state/protocol 등)·#ifdef 게이트 enum은 자동 불가 → override.
> 헬스체커는 **크로스파일 콜그래프**로 등록(`install_checkers_keyword`)되어 콜그래프 추적 필수.
> 상세 근거(file:line)는 `01-architecture/01-schema.md`.

- 런타임 덤프(`--enable-dump-keywords`) 방식은 keepalived 빌드 환경 필요 → 미채택. 정적 파싱으로 충분.
- 상세는 `01-architecture/01-schema.md`.

### GPL 채택으로 추출 자유도 상승
- GPL 수용(`02-license.md`) → 핸들러 검증 로직을 직접 참조·이식 가능 → 타입 추출 정확도 상승.

---

## TD-4: --config-test 미사용 (자체 검증 엔진)

### 결정
keepalived 바이너리의 `-t` / `--config-test`를 호출하지 않는다. 검증은 자체 구현.

### 근거
- `--config-test`는 keepalived **설치**를 요구. Windows엔 keepalived가 없음 → 익스텐션이 동작 안 함.
- 익스텐션은 특정 환경(OS/설치)에 의존하면 안 됨. 어디서나 동작해야 함.
- 자체 파서·검증 엔진은 keepalived 없이도 모든 플랫폼에서 동작.

### 참고
- `--config-test`는 존재하고 `(파일: Line N) 메시지` 형식으로 줄 번호도 줌.
  하지만 설치 의존 때문에 제외. 검증 로직 자체는 keepalived 소스의 `config_err_t` enum을 참고해 자체 구현.

---

## TD-5: 단일 스키마 (Single Source of Truth)

### 결정
지시어·타입·중첩·범위 규칙을 `schema/keepalived-spec.json` **한 곳**에 정의.
파서·검증·hover·자동완성이 모두 이 스키마를 읽는다.

### 근거
- CLAUDE.md "환경변수 주입 = 설정 중앙화" 원칙. 하드코딩·매직넘버 금지.
- keepalived 새 버전 대응 = 추출 스크립트 재실행 → 스키마만 갱신. 코드 수정 불필요.
- 여러 기능이 같은 데이터를 보므로 불일치 위험 제거.
