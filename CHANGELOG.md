# Changelog

본 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/) 을 따른다.

## [Unreleased] (0.23.0 작업 브랜치)

48시간 자율 품질 강화. 즉시 운영 가능·제품급 안정성 목표.

### Added
- 문서 아웃라인(DocumentSymbol): 브레드크럼·Ctrl+Shift+O·접기 향상.
- include 클릭 이동(DocumentLink): glob resolve 해 파일로 점프.
- 명령 팔레트: Show Schema Version / Validate Active File / Format Document.
- 문법 강조 확장: `~SEQ()` 시퀀스, IPv4/IPv6/CIDR, BOOL 키워드 (RFP §3.1).
- 스니펫 추가: vrrp_sync_group, unicast vrrp_instance, virtual_server_group, include.

### Changed
- 예외 처리를 어댑터 경계(guard/guardAsync)로 일원화 — 발생 지점 try-catch 제거.
- 전 provider 예외 격리 + 출력 채널 로깅.
- include resolve 로직을 공유 모듈로 추출(진단·링크 일치), 심링크 순환 방지.

## [1.0.0] - 2026-06-29

첫 정식 릴리스. 0.1.0 의 기능 토대 위에 정식 출시 품질 보강.

### Added
- 정의 이동(Go to Definition): 참조(`track_script` 등)에서 정의로 점프.
- Quick-fix(Code Action): enum 오타·미지시어에 근접 후보 교정 제안 (신뢰성 우선 — 오타 수준만).
- 사용자 설정(`contributes.configuration`): 진단 on/off, 필수누락·미참조 토글, 대용량 파일 한도.
- 편집 보조: 중괄호 기반 자동 들여쓰기(`indentationRules`/`onEnterRules`).
- 마켓 메타데이터: 아이콘, 갤러리 배너.

### Changed
- 스키마 커버리지 대폭 확대 (keepalived 2.3.4 실측 기반): 22 → 38 블록.
  global_defs 10→134, vrrp_instance 14→67, virtual_server 14→35 지시어.
  신규 헬스체크 블록 6종(SMTP/DNS/PING/UDP/FILE/BFD_CHECK), auth_hmac,
  vrrp_track_process/garp_group/track_group, static_* 리스트 블록, bfd_instance.
  타입은 소스 확인분만 검증, 나머지는 자동완성·hover 전용(오탐 0).
- 자동완성 트리거 정리: 공백마다 뜨던 팝업 제거 → 타이핑/명시 호출 시에만.
- 진단 경로 견고화: 예외 격리(try/catch), 대용량 파일 가드.

### Fixed
- include 다중파일 검증에 `reportMissingRequired` 옵션이 전달되지 않던 문제.

## [0.1.0] - 2026-06-29

첫 릴리스. keepalived.conf 풀기능 지원.

### Added
- 문법 강조 (tmLanguage, 스키마에서 생성).
- 4층 검증 엔진 (구문/타입/의미/include).
- 자동완성 (지시어·자식 블록·enum 값).
- Hover (설명·타입·범위·허용값·기본값).
- 스니펫 5종, 포맷터 (줄 기반 재들여쓰기).
- keepalived 2.3.4 기반 수작업 시드 스키마 (22블록).
- core(순수)/vscode(어댑터) 분리, LSP 확장 여지 확보.

### Notes
- 스키마 자동 추출기(`tools/extract-schema`)는 후순위(ADR-0008). 현재는 수작업 시드.
- 필수 누락·미참조 진단은 기본 off (ADR-0011).
