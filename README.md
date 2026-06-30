# keepalived-tools

`keepalived.conf` 를 위한 VSCode 익스텐션 — 문법 강조, 검증, 자동완성, hover, 정의 이동, quick-fix, 스니펫, 포맷터.

keepalived 설치 없이 모든 플랫폼에서 동작한다(자체 검증 엔진).

## 기능

| 기능 | 설명 |
|------|------|
| **문법 강조** | 블록·지시어·문자열·변수·주석(`#` 와 `!` 둘 다) |
| **검증** | 4층: 구문(괄호·미지시어·중첩) / 타입(범위·enum·IP·포트) / 의미(참조 무결성·중복) / include 다중파일 |
| **자동완성** | 현재 블록의 지시어·자식 블록·enum 허용값 |
| **Hover** | 지시어 설명·타입·범위·허용값·기본값·출처·빌드옵션·man 링크 |
| **정의 이동** | `track_script chk` 등 참조에서 정의(`vrrp_script chk`)로 점프 (F12) |
| **아웃라인** | 블록 구조를 브레드크럼·아웃라인·Ctrl+Shift+O 로 탐색 |
| **include 이동** | `include` 경로를 클릭해 대상 파일로 점프 (DocumentLink) |
| **Quick-fix** | enum 오타·미지시어에 "did you mean …?" 교정 제안 |
| **명령** | Show Schema Version / Validate Active File / Format Document (팔레트) |
| **스니펫** | `vrrp_instance`, `virtual_server`, `vrrp_script` 등 골격 |
| **포맷터** | 중괄호 깊이 기반 재들여쓰기 (주석·빈 줄 보존). 저장 시 자동 포맷 지원 |

## 신뢰성 우선

오탐(false positive)은 신뢰를 깎는다. 확실한 것만 error, 불확실하면 warning/info,
모르면 침묵한다(`$VAR`·`@조건부`·`~SEQ` 값은 검증 면제). 필수 누락·미참조 같은
편집 중 오탐이 잦은 검사는 기본 off (아래 설정으로 on).

quick-fix 도 같은 원칙 — 편집거리가 가까운 오타 수준 후보만 제안하고,
멀리 떨어진 후보는 들이밀지 않는다.

## 설정 (Settings)

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `keepalived.validation.enable` | `true` | 진단 전체 on/off |
| `keepalived.validation.reportMissingRequired` | `false` | 필수 지시어 누락 진단 (편집 중 오탐 방지로 기본 off) |
| `keepalived.validation.reportUnused` | `false` | 정의됐으나 미참조된 심볼 진단 (미참조도 합법이라 기본 off) |
| `keepalived.validation.maxFileSize` | `1048576` | 이 바이트 초과 파일은 검증 생략(에디터 응답성). `0` 이면 무제한 |

## 동작 원리

- keepalived 2.3.4 소스에서 키워드·타입·범위를 추출/검증해 단일 스키마
  (`schema/keepalived-spec.merged.json`)로 박제.
- 검증 로직은 VSCode 비의존 순수 `core` 모듈 → 추후 LSP 어댑터로 재사용 가능.

상세 설계: `docs/` (planning / architecture / ADR).

## 알려진 한계

- 스키마는 keepalived **2.3.4** 기준 수작업 시드. 흔한 블록은 완전 검증(`complete`),
  드문 블록은 미지시어를 침묵 처리해 오탐을 피한다(점진 확대 중, ADR-0009).
- 조건부 컴파일(`_WITH_SNMP_`, `_WITH_BFD_` 등) 지시어는 빌드에 따라 존재 여부가 다르다 — 진단하지 않는다.
- 정의 이동은 현재 단일 파일 기준. include 크로스파일 점프는 향후.

## 개발

```bash
npm install
npm run build      # 스키마 merge → 문법 생성 → 타입체크 → 번들
npm test           # core 단위 테스트 (node:test + tsx)
npm run package    # .vsix 패키징
```

## 라이선스

GPL-2.0-or-later. keepalived 소스를 사실 추출·로직 참조에 활용하므로 동일 라이선스를 따른다.
저작권 고지는 [`NOTICE`](NOTICE) 참조.

## 배포 전 준비물 (마켓플레이스)

- [ ] `publisher` 를 실제 등록된 Marketplace publisher ID로 교체 (`package.json`).
- [ ] PAT: 전역 PAT 2026-12-01 폐지 → Entra ID 게시 경로 사용.
- [ ] (선택) 스크린샷/GIF 추가 — 마켓 랜딩 시각 자료.
- [ ] (선택) README/CHANGELOG 영문 병기 — 글로벌 사용자 대상.
