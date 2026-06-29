# keepalived-tools

`keepalived.conf` 를 위한 VSCode 익스텐션 — 문법 강조, 검증, 자동완성, hover, 스니펫, 포맷터.

keepalived 설치 없이 모든 플랫폼에서 동작한다(자체 검증 엔진).

## 기능

| 기능 | 설명 |
|------|------|
| **문법 강조** | 블록·지시어·문자열·변수·주석(`#` 와 `!` 둘 다) |
| **검증** | 4층: 구문(괄호·미지시어·중첩) / 타입(범위·enum·IP·포트) / 의미(참조 무결성·중복) / include 다중파일 |
| **자동완성** | 현재 블록의 지시어·자식 블록·enum 허용값 |
| **Hover** | 지시어 설명·타입·범위·허용값·기본값 |
| **스니펫** | `vrrp_instance`, `virtual_server`, `vrrp_script` 등 골격 |
| **포맷터** | 중괄호 깊이 기반 재들여쓰기 (주석·빈 줄 보존) |

## 신뢰성 우선

오탐(false positive)은 신뢰를 깎는다. 확실한 것만 error, 불확실하면 warning/info,
모르면 침묵한다(`$VAR`·`@조건부`·`~SEQ` 값은 검증 면제). 필수 누락·미참조 같은
편집 중 오탐이 잦은 검사는 기본 off (설정으로 on).

## 동작 원리

- keepalived 2.3.4 소스에서 키워드·타입·범위를 추출/검증해 단일 스키마
  (`schema/keepalived-spec.merged.json`)로 박제.
- 검증 로직은 VSCode 비의존 순수 `core` 모듈 → 추후 LSP 어댑터로 재사용 가능.

상세 설계: `docs/` (planning / architecture / ADR).

## 라이선스

GPL-2.0-or-later. keepalived 소스를 사실 추출·로직 참조에 활용하므로 동일 라이선스를 따른다.
저작권 고지는 [`NOTICE`](NOTICE) 참조.

## 개발

```bash
npm install
npm run build      # 스키마 merge → 문법 생성 → 타입체크 → 번들
npm test           # core 단위 테스트 (node:test + tsx)
npm run package    # .vsix 패키징
```
