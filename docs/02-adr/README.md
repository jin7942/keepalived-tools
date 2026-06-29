# Architecture Decision Records (ADR)

> 비자명한 기술 결정을 시간순으로 박제한다.
> 한 결정 = 한 파일. 번호는 단조 증가. 한 번 부여한 번호·파일은 불변(상태만 바뀜).

## 작성 규칙

- 파일명: `NNNN-kebab-title.md` (예: `0001-language-typescript.md`)
- 상태: `Proposed` → `Accepted` → (`Superseded by NNNN` | `Deprecated`)
- 결정을 뒤집을 땐 기존 ADR을 지우지 않고 `Superseded` 표시 + 새 ADR 작성.
- 포맷: Context(왜 결정이 필요했나) / Decision(무엇을) / Consequences(대가·영향) / Alternatives(기각안).

## 기획 문서(`00-planning/01-tech-decisions.md`)와의 관계

- `tech-decisions.md`의 TD-1~5 = 기획 단계 합의. ADR-0001~0005가 이를 정식 포맷으로 승격.
- 구현 단계에서 나온 신규 결정은 ADR-0006부터.

## 인덱스

| # | 제목 | 상태 |
|---|------|------|
| [0001](0001-language-typescript.md) | 언어 = TypeScript 단일 | Accepted |
| [0002](0002-no-lsp-core-adapter-split.md) | LSP 미채택, core/adapter 분리 | Accepted |
| [0003](0003-schema-auto-extraction.md) | 스키마 소스 자동 추출 | Accepted |
| [0004](0004-no-config-test.md) | --config-test 미사용, 자체 검증 엔진 | Accepted |
| [0005](0005-single-schema-source.md) | 단일 스키마 (Single Source of Truth) | Accepted |
| [0006](0006-build-tooling.md) | 빌드 도구 = esbuild + tsc | Accepted |
| [0007](0007-test-runner.md) | 테스트 러너 = node:test + tsx | Accepted |
| [0008](0008-schema-extraction-deferred.md) | S1 추출기 vs 수작업 시드 스키마 | Accepted |
| [0009](0009-partial-schema-silence.md) | 부분 커버리지에서 미지시어 침묵 | Accepted |
| [0010](0010-include-resolution-in-adapter.md) | include resolve=어댑터, 순환감지=core | Accepted |
| [0011](0011-opt-in-required-and-unused.md) | required·미참조 진단 기본 off | Accepted |
| [0012](0012-user-settings-and-diagnostics-isolation.md) | 사용자 설정 노출 + 진단 경로 격리 | Accepted |
| [0013](0013-definition-and-quickfix.md) | 정의 이동·Quick-fix (신뢰성 우선 후보 제한) | Accepted |
| [0014](0014-navigation-and-commands.md) | 구조 내비게이션·명령·문법 강화 | Accepted |
| [0015](0015-robustness-hardening.md) | 견고성 강화 (코드 감사 반영) | Accepted |
