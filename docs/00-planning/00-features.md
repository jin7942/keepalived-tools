# 00 - Features (기능 정의)

> keepalived-tools: keepalived.conf 를 위한 VSCode 익스텐션.
> 본 문서는 v1.0 기능 범위를 정의한다. 설계 상세는 `01-architecture/` 참조.

---

## 1 제품 한 줄 정의

keepalived 설정 파일(`keepalived.conf`)을 작성하는 인프라/네트워크 엔지니어가
**데몬을 띄우기 전에** 오타·타입 오류·범위 위반·참조 오류를 에디터에서 즉시 잡도록 돕는다.

마켓플레이스에 keepalived 전용 익스텐션이 부재한 공백 시장을 선점한다.

---

## 2 목적

| 항목 | 내용 |
|------|------|
| 성격 | 오픈소스, 무료 공개 |
| 가치 | 포트폴리오 / 기술 학습 / 시장 선점 |
| 수익 | 직접 수익 목표 없음 (마켓플레이스에 결제 기능 자체 없음) |
| 라이선스 | GPL-2.0-or-later (`02-license.md` 참조) |

---

## 3 v1.0 기능 범위 (In Scope)

풀기능 v1.0 을 목표로 한다. MVP 단계 출시가 아니라 처음부터 완성품.

### 3.1 Syntax Highlighting (구문 강조)

keepalived 파서가 실제 처리하는 **고급 문법 전부** 색칠.

| 대상 | 비고 |
|------|------|
| 주석 `#` 그리고 `!` | keepalived는 둘 다 주석. 양쪽 처리 필수 |
| 블록 `{` `}` | 중첩 |
| 지시어(directive) | global_defs, vrrp_instance, virtual_server 등 |
| 값 타입 | IP, 숫자, BOOL(on/off/true/false/yes/no), 문자열 |
| `"quoted string"` | 인용 문자열 |
| 변수 치환 `$` | 고급 문법 |
| 조건부 `@` | 고급 문법 |
| 시퀀스 `~SEQ()` | 고급 문법 |
| `include` 지시어 | glob/brace 확장 |

### 3.2 Validation (검증) — 4층 풀스펙

`01-architecture/03-validation.md` 에 상세. 4개 층 전부 v1.0 포함.

| 층 | 내용 | 예 |
|----|------|-----|
| 구문(syntax) | 괄호 짝, 알 수 없는 지시어, 잘못된 블록 중첩 | `real_server`가 `virtual_server` 밖 |
| 타입(type) | 값 타입·범위·enum | priority 1-255, state ∈ {MASTER,BACKUP} |
| 의미(semantic) | 참조 무결성 | track_script가 존재하는 vrrp_script 참조하는지 |
| include | glob 다중 파일을 한 프로젝트로 묶어 참조 해석 | `include /etc/keepalived/*.conf` |

### 3.3 Completion (자동완성)

- 블록 골격, 지시어 이름, enum 값 후보
- 현재 블록 컨텍스트에 맞는 지시어만 제안 (스키마 기반)

### 3.4 Hover (문서 표시)

- 지시어 위에 마우스 올리면 설명·타입·허용값 표시
- 출처: keepalived 소스 추출 + manpage 보강

### 3.5 Snippets (스니펫)

- `vrrp_instance`, `virtual_server` 등 자주 쓰는 블록 골격 자동 삽입

### 3.6 Formatter (포맷터)

- 들여쓰기 규칙 정규화, 블록 정렬

---

## 4 비범위 (Out of Scope) — v1.0 제외

| 제외 항목 | 이유 |
|-----------|------|
| LSP (Language Server Protocol) | VSCode 단독이면 내부 로직으로 충분. 나중 확장 여지만 설계에 남김 (`01-architecture/00-overview.md`) |
| `keepalived --config-test` 호출 | keepalived 바이너리 설치 의존. Windows엔 없음. 자체 검증 엔진으로 대체 |
| 다른 에디터 지원 (Neovim 등) | 현재 계획 없음. core 분리로 추후 가능 |
| keepalived C 코드 직접 사용/번들 | 소스에서 사실(스키마) 추출 후 TS 재구현. C 바이너리 의존 안 함 |

---

## 5 핵심 설계 원칙 (요약)

- **keepalived 소스 최대 활용**: 지시어·중첩·타입·검증 로직을 소스에서 끌어온다. 수작업 하드코딩 최소화.
- **단일 스키마(single source of truth)**: 파서·검증·hover·자동완성이 `keepalived-spec.json` 하나를 공유.
- **core / vscode 분리**: 검증 로직은 VSCode API에서 독립한 순수 모듈. 추후 LSP 확장 대비.

상세 근거는 `01-tech-decisions.md`.
