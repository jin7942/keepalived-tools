# keepalived-tools 작업 체크리스트

> 다음 세션 인계용. 현재 위치와 다음 할 일.

---

## 현재 상태 (2026-06-29, 구현 완료 — 출시 수준)

- 기획·설계·**구현 완료**. 테스트 66/66, 클린 빌드, .vsix 패키징 성공(30KB).
- 브랜치: `docs-design`. 커밋 7개. ADR-0001~0011.
- 스키마 22블록(수작업 시드, 2.3.4 실측). 자기리뷰 2종 반영(오탐/패키징).
- 초안 백업: `docs/_draft-backup/`.

### 구현 완료 (S0~S14, S1/S13일부 제외)
- S0 셋업, 시드스키마, merge/grammar 빌드도구.
- S2 문법, S3 파서, S4~S7 검증4층, S8~S11 features, S12 어댑터, S14 패키징.

### 출시 전 남은 일 (비차단 / 사용자 자산·정책)
- [ ] publisher 실제 Marketplace ID 등록 + package.json 교체.
- [ ] icon PNG(128+) 추가 → package.json "icon".
- [ ] (선택) README/CHANGELOG 영문 병기.
- [ ] release: docs-design → v0.1.0 릴리스 브랜치 정리 → main MR → 태그 v0.1.0.
- [ ] `docs/_draft-backup/` 제거 여부 결정.

### 의도적 후순위 (v1.x)
- S1 자동추출기(walk-registration/infer-types/resolve-consts) — ADR-0008.
  현재 수작업 시드 대체. 스키마 커버리지는 흔한 블록에 complete:true 부여하며 점진 확대.
- @vscode/test-electron 통합 테스트 (vscode 런타임). core는 단위 커버 완료.

### 재설계로 확정된 사실 (초안 정정)
- 등록 파일 5→17개, install 함수 4→5종(conditional 추가), 최대 중첩 2→3.
- 타입 범위는 자동 추출 가능(~70-80%), strcmp enum은 override 필수.
- 헬스체커는 크로스파일 콜그래프 등록 → 추출기는 콜그래프 추적 필요.
- override 레이어 확정: spec.json(자동)/overrides.json(수작업)/merged.json(병합).
- 버전 정책 확정: 최신 stable(2.3.4) 기준, #ifdef는 최대집합 추출.

---

## 확정된 기획 결정 (변경 시 docs 갱신 필수)

| 항목 | 결정 |
|------|------|
| 제품 | keepalived.conf용 VSCode 익스텐션 (하이라이팅+검증+자동완성+hover+스니펫+포맷터) |
| 목적 | 오픈소스 무료 공개. 포트폴리오/학습/시장선점. 수익 목표 없음 |
| 라이선스 | GPL-2.0-or-later. keepalived 소스 최대 활용 |
| 언어 | TypeScript 단일 |
| 아키텍처 | LSP 없음. core(순수)+vscode(어댑터) 분리. 추후 LSP 확장 여지만 확보 |
| 검증 | 4층 풀스펙: 구문+타입+의미(참조무결성)+include 다중파일 |
| 스키마 | keepalived 소스 정적 파싱 자동추출 + 타입 수작업 보정 |
| config-test | 미사용 (설치 의존). 자체 검증 엔진 |
| 출시 | 풀기능 v1.0 일괄 공개 |

상세 근거: `docs/00-planning/`, `docs/01-architecture/`

---

## 설계 문서 (작성 완료)

- [x] docs/00-planning/00-features.md — 기능 정의, 범위/비범위
- [x] docs/00-planning/01-tech-decisions.md — TD-1~5 기술 결정+근거
- [x] docs/00-planning/02-license.md — GPL 선택, 활용 범위, attribution
- [x] docs/00-planning/03-roadmap.md — v1.0 개발 단계 S0~S14
- [x] docs/01-architecture/00-overview.md — 폴더구조, 모듈책임, 데이터흐름
- [x] docs/01-architecture/01-schema.md — keepalived-spec.json 구조, 추출 방식
- [x] docs/01-architecture/02-parser.md — Lexer, AST, 오류복구
- [x] docs/01-architecture/03-validation.md — 4층 검증 상세

---

## 다음 작업 (구현) — 로드맵 S0부터

순서는 docs/00-planning/03-roadmap.md §2 참조. 의존성 순서.

- [ ] **문서 커밋** (docs-design → 사내표준상 docs- 브랜치, MR target vX.Y.Z)
      - 주의: 아직 vX.Y.Z 릴리스 브랜치 없음. 첫 릴리스면 main에서 v0.1.0 생성 후 진행
      - 커밋 메시지: `docs: 기획·설계 문서 추가`
- [ ] **S0 프로젝트 셋업**: package.json, tsconfig, 빌드, contributes 골격, 언어 등록(keepalived)
- [ ] **S1 스키마 추출 도구**: tools/extract-schema. keepalived 소스 clone → install_keyword 파싱
      - 핵심 토대. 여기 먼저 투자
      - 소스 위치 참고: keepalived/{vrrp,check,bfd,core}/*_parser.c
      - 값 타입은 manpage + 핸들러 휴리스틱 보정
- [ ] **S2 Syntax Highlighting**: tmLanguage.json + language-configuration.json
      - 주석 # 와 ! 둘 다 처리 필수
- [ ] **S3 Parser**: core/parser (Lexer → AST)
- [ ] **S4 검증 구문층**: core/validation/syntax.ts
- [ ] **S5 검증 타입층**: core/validation/type.ts
- [ ] **S6 검증 의미층**: core/validation/semantic.ts (심볼테이블)
- [ ] **S7 include 다중파일**: core/validation/include.ts
- [ ] **S8 Hover**: vscode/hover.ts
- [ ] **S9 Completion**: vscode/completion.ts
- [ ] **S10 Snippets**
- [ ] **S11 Formatter**: vscode/formatter.ts
- [ ] **S12 VSCode 어댑터 통합**: vscode/extension.ts
- [ ] **S13 테스트**: core 단위 + 통합 (CLAUDE.md 테스트 컨벤션)
- [ ] **S14 패키징·배포**: vsce, LICENSE(GPL-2.0), README, attribution

---

## 미해결/추후 결정 사항

- ~~스키마 override 레이어 분리 방식~~ → **확정**: spec/overrides/merged 3파일 (schema 01 §4.4)
- ~~keepalived 버전 기준~~ → **확정**: 최신 stable 2.3.4, #ifdef 최대집합 (overview §7)
- publisher 계정 + PAT (배포 시점). 전역 PAT 2026-12-01 폐지 → Entra ID 경로
- 언어 file association glob 최종 목록 → S0/S2에서 확정 (overview §6에 후보)
- 콜그래프 추적기 구현 깊이: 경량 스캐너 vs 정식 파서 → S1a 착수 시 결정 (schema §4.1: 경량 권장)
- overrides.json 초기 작성 대상 목록 (strcmp enum 전수) → S1d에서 소스 grep으로 확정
