# Changelog

본 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/) 을 따른다.

## [Unreleased]

### Added
- 문법 강조 (tmLanguage, 스키마에서 생성).
- 4층 검증 엔진 (구문/타입/의미/include).
- 자동완성 (지시어·자식 블록·enum 값).
- Hover (설명·타입·범위·허용값·기본값).
- 스니펫 5종, 포맷터 (줄 기반 재들여쓰기).
- keepalived 2.3.4 기반 수작업 시드 스키마 (17블록).
- core(순수)/vscode(어댑터) 분리, LSP 확장 여지 확보.

### Notes
- 스키마 자동 추출기(`tools/extract-schema`)는 후순위(ADR-0008). 현재는 수작업 시드.
- 필수 누락·미참조 진단은 기본 off (ADR-0011).
