# CLAUDE.md — keepalived-tools

> 프로젝트 작업 시 반드시 따르는 규칙.
> 사내 표준(브랜치/버전/커밋) + 설계 원칙·패턴·컨벤션 통합.
> 전역 가이드라인(`~/.claude/CLAUDE.md`)을 상속하며, 충돌 시 본 문서가 우선.

---

## [REQUIRED] 브랜치/버전/커밋 규칙 (사내 표준)

### 토폴로지 (단일 main 모델)

```
main ← vX.Y.Z (릴리스 통합, short-lived) ← feat-*, fix-* 등 (작업 단위)
hotfix/vX.Y.Z → main 직접 머지 (긴급 패치 예외)
```

- **단일 main 모델**: `production`/`develop`/`staging` 등 환경별 장수 브랜치 신설 금지
- 태그(`vX.Y.Z`)는 **코드 버전 식별자**. 브랜치는 *작업 흐름*만 표현
- `feat-*` 는 `main` 직접 MR 금지. 반드시 `vX.Y.Z` 경유
- `hotfix/vX.Y.Z` 만 `main` 직접 분기·머지 허용

### 브랜치 명명

| 종류 | 형식 | 예 |
|---|---|---|
| 릴리스 통합 | `vX.Y.Z` | `v0.21.0` |
| 작업 | `<type>-<kebab-case>` | `feat-topology-layout`, `fix-snmp-timeout` |
| 핫픽스 | `hotfix/vX.Y.Z` | `hotfix/v0.20.7` |

Type: `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`, `test`, `style`, `ci`

규칙:
- 작업 브랜치는 **하이픈** (`feat-foo`), slash 금지 (`feature/foo` 금지)
- 작업 브랜치명에 버전 prefix 금지 (이미 `vX.Y.Z` 안에 있음)
- 릴리스/핫픽스만 슬래시 (`hotfix/vX.Y.Z`)

### 버전 (SemVer)

| Bump | 언제 | 예 |
|---|---|---|
| MAJOR | API 깨짐, 아키텍처 변경, 호환 안 됨 | v1.2.3 → v2.0.0 |
| MINOR | 기능 추가, 호환 유지 | v1.2.3 → v1.3.0 |
| PATCH | 버그 수정, 호환 유지 | v1.2.3 → v1.2.4 |

- 태그 형식: `vX.Y.Z` (소문자 v), 정규식 `^v\d+\.\d+\.\d+$`
- 태그 부여 전 모든 버전 파일 동기화 (`build.gradle`, `package.json`, `pyproject.toml` 등)
- v1.0.0 도달 전(`0.x.y`)은 MINOR도 호환 깰 수 있음 (SemVer 표준)
- 태그 재사용 금지 (한 번 부여한 `vX.Y.Z`는 영구)

### 커밋 (Conventional Commits)

형식:

```
<type>(<scope>): <subject>

<body>

<footer>
```

- type: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `style`, `ci`, `release`
- subject: 50자 이내, 명령형, 마침표 없음
- body: 72자/줄, *왜* 변경했는지 중심
- breaking change: footer에 `BREAKING CHANGE: ...` 명시 → MAJOR bump 필수

예:

```
feat(web): WebSocket wss 자동 매핑 추가

HTTPS 페이지에서 Mixed Content 차단되던 문제 해소.
```

### 워크플로

- **일반**: `main`에서 `vX.Y.Z` 생성 → `vX.Y.Z`에서 `feat-*` 분기 → MR(target: `vX.Y.Z`) → 머지 → 다른 기능 반복 → 릴리스 시 버전 동기화 + CHANGELOG + `vX.Y.Z` → `main` MR → 머지 후 태그 부여
- **핫픽스**: `main`에서 `hotfix/vX.Y.Z` 분기 → 수정 + PATCH bump → MR(target: `main`) → 머지 후 태그 부여
- **릴리스 커밋 메시지**: `release: vX.Y.Z`

### MR 룰

| 종류 | source → target | 머지 방식 |
|---|---|---|
| 작업 | `feat-*` → `vX.Y.Z` | merge commit (squash 선택 가능) |
| 릴리스 | `vX.Y.Z` → `main` | **merge commit, squash 금지** |
| 핫픽스 | `hotfix/vX.Y.Z` → `main` | **merge commit, squash 금지** |

릴리스/핫픽스 squash 금지 이유: 어떤 작업이 어느 릴리스에 들어갔는지 히스토리 추적.

### 브랜치 삭제 정책

- 머지된 작업 브랜치(`feat-*`, `fix-*`, …) → **즉시 삭제**
- 머지된 핫픽스 브랜치 → **즉시 삭제**
- `vX.Y.Z` 릴리스 브랜치 → **`main` 머지 + 태그 후 삭제**
- GitLab MR "Delete source branch when merge request is accepted" 기본 활성화
- 로컬 브랜치 정리는 개발자 자율 (강제 X)

### 금지

- `main`에 직접 push (hotfix 머지 제외)
- `feat-*`를 `main`으로 직접 MR
- 핫픽스 외에 `main` 직접 분기
- 릴리스/핫픽스 MR squash 머지
- force-push to `main` 또는 `vX.Y.Z`
- 태그 재사용 (한 번 부여한 `vX.Y.Z`는 영구)
- `production`/`develop`/`staging` 등 환경별 장수 브랜치 신설
- 머지 완료된 브랜치 방치
- 작업 브랜치명에 slash 사용 (`feature/foo` 금지 → `feat-foo`)

### 빠른 결정

| 작업 | 브랜치 |
|---|---|
| 새 기능 (다음 릴리스 없음) | `main`에서 `vX.Y.Z` 생성 → `feat-*` 분기 |
| 새 기능 (다음 릴리스 진행 중) | `vX.Y.Z`에서 `feat-*` 분기 |
| 일반 버그 | `vX.Y.Z`에서 `fix-*` 분기 |
| 운영 긴급 버그 | `main`에서 `hotfix/vX.Y.Z` 분기 |
| 리팩토링 | `vX.Y.Z`에서 `refactor-*` 분기 |

---

# 설계 원칙·패턴·컨벤션

> 프로젝트에서 반복적으로 사용하는 설계 원칙, 패턴, 컨벤션.

## 1 핵심 설계 원칙

### 1.1 SOLID 원칙

- **SRP** (단일 책임): 클래스/모듈은 하나의 책임만. "변경의 이유가 하나뿐"
  - 예: UserService는 CRUD만, 이메일 발송은 EmailService로 분리
- **OCP** (개방-폐쇄): 확장에 열림, 수정에 닫힘
  - 예: 새 결제 방식 추가 시 PaymentProcessor 구현체만 추가
- **ISP** (인터페이스 분리): 사용하지 않는 메서드에 의존 금지
  - 예: `Readable`, `Writable` 분리 vs 거대한 `FileHandler`
- **DIP** (의존성 역전): 구현체가 아닌 추상화에 의존
  - 예: Service가 JpaRepository 직접 사용 대신 Port 인터페이스 사용

### 1.2 버전 관리 (Semantic Versioning)

형식: `MAJOR.MINOR.PATCH`

| 변경 내용 | 버전 |
|----------|------|
| API 응답 구조 변경, 필수 파라미터 추가 | MAJOR |
| 새 엔드포인트 추가, 선택적 파라미터 추가 | MINOR |
| 버그 수정, 성능 개선, 리팩토링 | PATCH |

- 개발 단계: `0.x.x` (언제든 깨질 수 있음)
- 정식 릴리스: `1.0.0`부터
- 프리릴리스: `1.0.0-alpha.1`, `1.0.0-rc.1`

### 1.3 환경변수 주입 (Configuration Centralization)

- 상수값·설정값은 코드에 하드코딩하지 않음
- 하나의 지점(Config 클래스, .env)에서 주입
- 환경별(dev/staging/prod) 설정 분리

| 언어/프레임워크 | 방식 |
|---------------|------|
| Spring Boot | `@ConfigurationProperties`, `application.yml` |
| Node.js | `dotenv`, `config` |
| React | `.env`, `import.meta.env` |

주의: `.env`는 `.gitignore`에. `.env.example`로 변수 목록 문서화. 기본값은 개발 환경 기준.

### 1.4 DTO와 VO 활용 (Java Record 기반)

- **DTO**: 계층 간 데이터 전송. `*RequestDto`, `*ResponseDto`
- **VO**: 재사용 가능한 불변 값 객체. 값으로 동등성 비교. `*Vo`

Record 사용 이유: 불변성, `equals()`/`hashCode()`/`toString()` 자동 생성, 보일러플레이트 제거, 의도 명확.

### 1.5 문서화 (주석/JavaDoc/Swagger/TSDoc)

- 코드는 "무엇을/어떻게", 주석은 "왜"를 설명
- 공개 API는 반드시 문서화

| 언어 | 도구 |
|------|------|
| Java/Kotlin | JavaDoc/KDoc, Swagger/OpenAPI |
| TypeScript | TSDoc |
| Python | docstring |

필수 문서화: 공개 메서드 파라미터/반환값/예외, 비즈니스 로직 의도, 복잡한 알고리즘, API 요청/응답 형식.
불필요: 자명한 메서드명, 단순 getter/setter.

---

## 2 공통 응답 형식 (ApiResponse Wrapper)

모든 REST API 응답을 단일 형식으로 통일. 래퍼 함수로 생성.

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | boolean | 요청 성공 여부 |
| `code` | string | 결과 코드 ("OK" 또는 에러코드) |
| `message` | string | 사람이 읽을 메시지 |
| `data` | T | 실제 응답 데이터 |
| `timestamp` | datetime | 응답 시각 |

- 일관성: 프론트엔드에서 모든 API 동일 처리
- 페이징은 `data` 안에 `content`, `page`, `totalElements`
- 바이너리 응답(파일 다운로드)은 예외

---

## 3 멱등성 (Idempotency)

같은 요청을 N번 보내도 결과가 1번과 동일.

### 3.1 HTTP 메서드별

| 메서드 | 멱등 | 비고 |
|--------|------|------|
| GET | O | 조회는 본질적 멱등 |
| PUT | O | 같은 값 덮어쓰기 |
| DELETE | O | 두 번째부터 404 또는 무시 |
| PATCH | △ | 절대값 멱등 / 증감 비멱등 |
| POST | X | Idempotency-Key로 보완 |

### 3.2 Idempotency-Key

POST·비멱등 PATCH에 클라이언트 생성 키 전달. 서버가 키+응답 보관 → 중복 시 저장 응답 재반환.

| 구성 | 설명 |
|------|------|
| 키 생성 | 클라이언트 UUID v4 |
| 저장소 | Redis (TTL 24시간) |
| 저장 값 | `{requestHash, responseBody, statusCode}` |

처리 정책:
- 같은 키 + 같은 본문 → 저장된 응답 반환
- 같은 키 + 다른 본문 → `422`
- 키 없는 POST 중복 → DB 레벨 멱등성에 위임

### 3.3 DB 레벨 멱등성

| 기법 | 사용 시점 |
|------|----------|
| `UNIQUE` + 예외 catch | 자연키 존재 |
| `UPSERT` (`ON CONFLICT DO UPDATE`) | 갱신 허용 |
| 낙관적 락 (`@Version`) | 동시 갱신 충돌 감지 |
| 처리 이력 테이블 | 외부 이벤트 ID 중복 차단 |

### 3.4 외부 API / 상태 전이

- 외부 API 재시도(지수 백오프) 시 Idempotency-Key 필수 (중복 결제/발송 방지)
- 상태 전이 멱등성: 같은 상태 재전이 시 정책 명시
  - 무시(no-op): 멱등성 강제 (알람 해제 등)
  - 예외: 상태 흐름 엄격 (결제 완료 등)

### 3.5 주의점

- Idempotency-Key는 비즈니스 키와 별개
- GET에는 키 불필요
- TTL 필수
- 멱등성 ≠ 응답 캐싱

---

## 4 예외 전파 방식 (Exception Hierarchy)

발생 지점에서 처리하지 않고 `throws`로 전파, GlobalExceptionHandler에서 집중 처리.

### 4.1 계층 구조

```
CustomException (최상위, errorCode 포함)
├── BusinessException (4xx) - 사용자 해결 가능
│   ├── ResourceNotFoundException (404)
│   ├── DuplicateResourceException (409)
│   ├── ValidationException (400)
│   └── UnauthorizedException (401)
└── TechnicalException (5xx) - 시스템 문제
    ├── ExternalApiException
    ├── DatabaseException
    └── InfrastructureException
```

### 4.2 GlobalExceptionHandler

`@RestControllerAdvice`로 모든 예외를 ApiResponse로 변환. Controller/Service는 throw만.
핸들러 순서: 구체 → 추상 (Spring은 구체 우선 매칭).

### 4.3 에러 코드 체계

| 형식 | 예시 |
|------|------|
| `<도메인>_<상태>` | `USER_NOT_FOUND` |
| `E<번호>` | `E40401` |
| `<HTTP>_<도메인>_<번호>` | `404_USER_001` |

번호 범위: 인증(10000~), 입력검증(20000~), 비즈니스(40000~), 외부시스템(50000~), 알 수 없음(90000~).

### 4.4 로깅 레벨 정책

| 예외 유형 | 레벨 | 알람 |
|-----------|------|------|
| BusinessException (4xx) | `WARN` | X |
| TechnicalException (5xx) | `ERROR` | O |
| 예상 못한 RuntimeException | `ERROR` | O + 풀스택 |
| ValidationException | `INFO` | X |

### 4.5 에러 메시지 정책

| 대상 | 내용 | 예시 |
|------|------|------|
| 사용자용 (`message`) | 친절·모호 | "요청을 처리할 수 없습니다" |
| 로그용 (`detail`) | 정확·상세 | "DB connection pool exhausted (50/50)" |
| 추적 ID (`traceId`) | UUID, 응답·로그 포함 | "a3f2b1c4..." |

기술 예외의 내부 정보(스택트레이스, DB 구조, API 키)는 사용자 응답에 절대 노출 금지.

### 4.6 외부 API 예외 매핑

외부 예외를 그대로 던지지 않고 도메인 예외로 변환.

| 외부 상황 | 우리 예외 | 처리 |
|-----------|----------|------|
| 4xx | `ExternalApiException` (5xx) | ERROR 로깅 |
| 5xx | `ExternalApiException` (5xx) | 재시도 + 알람 |
| 타임아웃 | `ExternalApiException` (5xx) | 재시도 (멱등성 필수) |
| 인증 실패 | `InfrastructureException` | 키 만료 점검 |

---

## 5 로그 컨벤션 (Logging)

**카테고리 + 표준 필드 + 보관 정책** 세 축으로 표준화. 도구 비종속 계약만 정의.

### 5.1 카테고리

| 카테고리 | 목적 | 주 소비자 |
|---------|------|----------|
| `application` | 비즈니스 흐름 주요 지점 | 개발자 |
| `performance` | 응답 시간·slow query | 개발자, 운영 |
| `audit` | 누가/무엇을/언제 | 보안팀, 컴플라이언스 |
| `security` | 비정상 접근·공격 | 보안팀 |
| `access` | 요청·응답 트래픽 | 운영 |
| `error` | 예외 발생 (§4 연계) | 개발자, 운영 |

### 5.2 레벨

`FATAL` / `ERROR` / `WARN` / `INFO` / `DEBUG` / `TRACE`. 카테고리와 직교(독립).
런타임 동적 레벨 변경 가능해야 함 (재배포 없이 DEBUG ON/OFF). §4.4와 일관성 유지.

### 5.3 표준 필드

**공통 (강제)**: `timestamp`(ISO8601), `level`, `category`, `service`, `env`, `version`, `traceId`, `spanId`, `userId`

**카테고리별 권장**:
```
performance:  durationMs, threshold, operation, resource
audit:        action, actor, target, before, after, outcome
security:     eventType, clientIp, userAgent, attemptCount
error:        errorCode, exceptionClass, stackTrace, request
access:       method, path, statusCode, responseTime
```

표기는 프로젝트당 camelCase 또는 snake_case 하나로 통일.

### 5.4 디버깅 가능성

- 분기 결정 근거 기록: `decision`, `reason` 필드로 "왜 이 분기로 갔는가"
- 컨텍스트 보존: 실패 시 요청/응답 본문 일부, 핵심 중간 변수 (마스킹 후)
- 임시 디버그 로그(`console.log("here1")`)는 PR 머지 전 제거. Lint(`no-console`)로 차단

### 5.5 메시지 작성

- 동사 + 목적어: `"User created"`, `"Order shipped"`
- 변수는 본문 아닌 필드로: `"User created"` + `userId: "12345"`
- 금지: `"OK"`, `"done"`, `"User created: id=12345"`

### 5.6 상관관계 ID 전파

- 진입점에서 `traceId` 1회 발급 (외부 요청에 있으면 승계)
- 동기/비동기/외부 API 헤더까지 전파
- `traceId`(요청 전체) / `spanId`(구간) / `correlationId`(외부 연계)
- 구현: Java MDC, Node AsyncLocalStorage, Go context — 계약은 동일

### 5.7 분석 가능성

- JSON 등 구조화 강제, plain text 금지
- 저카디널리티(`category`, `level`)만 라벨, 고카디널리티(`userId`, `traceId`)는 필드
- `action`, `outcome` 등 enum 사전 정의

### 5.8 민감정보 마스킹

| 데이터 | 방식 |
|--------|------|
| 비밀번호, 토큰, API 키 | 완전 제거 |
| 주민번호, 카드번호 | 부분 마스킹 (`123456-*******`) |
| 이메일, 전화번호 | 정책에 따라 (해시) |

### 5.9 보관 정책

| 카테고리 | 원본 | 집계 | 비고 |
|---------|------|------|------|
| `application` | 7~30일 | 필요 시 | 디버깅 후 폐기 |
| `performance` | 30일 | 90일 | 집계 후 원본 폐기 |
| `audit` | **1년+, immutable** | 영구 | 규정. 수정/삭제 금지 |
| `security` | 90일+ | 1년 | 사후 추적 |
| `access` | 30일 | 1년 | 트래픽 분석 |
| `error` | 90일 | 영구 (코드별 집계) | §4 연동 |

audit와 application은 다른 저장소 권장 (보안 영향 분리).

### 5.10 적용 메커니즘

- 횡단 관심사로 일괄 적용 (AOP/Interceptor/Middleware/Decorator). 메서드별 수동 호출 금지
- 카테고리별 로거 분리 권장 (`PerformanceLogger`, `AuditLogger`)
- ERROR는 GlobalExceptionHandler 단일 진입 (§4)

---

## 6 테스트 컨벤션 (Testing)

구현 디테일이 아니라 **행동(behavior)** 검증. 회귀 방어 + 설계 피드백 + 살아있는 명세.

### 6.1 피라미드

| 종류 | 범위 | 비율 | 비고 |
|------|------|------|------|
| `unit` | 단일 클래스/함수, 외부 격리 | ~70% | 가장 많이/빠르게 |
| `integration` | 여러 컴포넌트 (DB/API 가능) | ~20% | 실제 인프라 권장 |
| `contract` | 외부 시스템 요청·응답 계약 | ~5% | API 클라이언트·스키마 |
| `e2e` | 사용자 시나리오 전체 스택 | ~5% | 핵심 여정만 |
| `performance` | 성능·부하 | 별도 | PR 차단 X |

### 6.2 네이밍 (프로젝트당 하나 선택)

- should-when: `should_throwException_when_userNotFound`
- Given-When-Then: `given_emptyCart_when_checkout_then_throwException`
- 자연어(영문): `"creates user when email is unique"`

한 테스트 = 한 행동. `and`가 들어가면 분리 신호. 메서드명 < 100자.

### 6.3 구조 (AAA / GWT)

```
Arrange (Given): 입력·픽스처·모의 준비
Act     (When) : 검증 대상 호출 (1줄)
Assert  (Then) : 결과 검증 (1~3줄)
```

빈 줄로 영역 구분. Act가 여러 줄이면 unit이 아닌 시나리오 테스트.

### 6.4 커버리지 정책 (혼합)

| 영역 | 정책 | 임계치 |
|------|------|--------|
| 핵심 도메인 (결제/주문/인증) | 강제 | 라인 80%+, 분기 70%+ (PR 차단) |
| 일반 비즈니스 로직 | 가치 우선 | 정성 (분기·경계값·예외) |
| 인프라/어댑터 | 통합 테스트 대체 | 정성 |
| 자명한 코드 (getter, DTO) | 테스트 안 함 | — |

- 수치는 최소선, 100% 추구 금지
- 분기 커버리지 > 라인 커버리지 신뢰
- "구현 변경 시 깨지면" 행동 대신 구현 테스트 중 → 재작성

### 6.5 테스트 데이터

| 패턴 | 사용 시점 |
|------|----------|
| Test Data Builder | 필드 많은 객체 (`.with*()` 체인) |
| Object Mother | 자주 쓰는 시나리오 (`aValidUser()`) |
| Fixture 파일 | 대용량·복잡 데이터 (변경 드물 때) |
| Random | 시드 고정 필수 |

금지: 테스트 간 공유 가변 픽스처, 운영 데이터 직접 사용.

### 6.6 외부 의존 처리

| 용어 | 정의 | 사용 |
|------|------|------|
| `Stub` | 정해진 값 반환 | 반환값만 필요 |
| `Mock` | 호출 여부·인자·횟수 검증 | 부수효과가 행동의 일부 |
| `Spy` | 실제 객체 감싸 호출 기록 | 부분만 가짜 |
| `Fake` | 단순화 구현 (in-memory DB) | 통합, Stub 부족 시 |

- 시간: `Clock` 주입 → 고정 시각
- 난수: `Random` 주입 + 시드 고정
- DB: 통합은 실제 DB(테스트 컨테이너), unit은 Repository Stub/Fake
- 외부 API: contract 테스트로 분리, unit은 Stub. 실제 호출 금지

### 6.7 격리·재현성

- 순서 무관, 병렬 안전 (전역 상태 공유 금지)
- 외부 인터넷 의존 금지, 시간 의존 금지 (`Clock` 주입)
- `@AfterEach`로 자원 정리 (DB rollback)
- flaky 테스트 제로 톨러런스 (즉시 수정 또는 격리, mute 금지)

### 6.8 적용 메커니즘

- CI 필수: PR마다 unit + integration, 실패 시 머지 차단
- unit 전체 < 1분, integration < 5분 권장
- 깨진 테스트 mute 금지 (비활성화 시 이슈 링크 + 만료일)

---

## 7 공통 엔티티 상속 (BaseEntity)

모든 엔티티가 상속받는 공통 필드. JPA 콜백/Auditing으로 자동 설정.

| 필드 | 타입 | 설정 |
|------|------|------|
| `createdAt` | LocalDateTime | @PrePersist |
| `updatedAt` | LocalDateTime | @PreUpdate |
| `createdBy` | String | AuditorAware (선택) |
| `updatedBy` | String | AuditorAware (선택) |

주의:
- **ID는 상속하지 않음** (엔티티마다 전략 다름)
- soft delete 필요 시 `deletedAt`, `isDeleted` 추가
- 낙관적 락 필요 시 `@Version` 추가

---

## 8 팩토리 메서드 패턴

객체 생성 로직을 static 메서드로 캡슐화. 의미 있는 이름으로 의도 명확화.

| 메서드 | 의미 | 예시 |
|--------|------|------|
| `of()` | 파라미터 그대로 | `LocalDate.of(2024, 1, 1)` |
| `from()` | 다른 타입 변환 | `Instant.from(zonedDateTime)` |
| `create()` | 복잡한 생성 로직 | `Order.create(cart, user)` |
| `empty()` | 빈/기본 객체 | `Optional.empty()` |
| `valueOf()` | 문자열 변환 | `Integer.valueOf("123")` |

사용 위치: 엔티티 상태별 생성(`Order.createPending()`), DTO 변환(`UserResponse.from(user)`), VO 생성(`Money.of(1000, KRW)`).

---

## 9 상태 관리 패턴 (State Machine)

상태 전이는 setter가 아닌 비즈니스 메서드로만.

```
PENDING → ACTIVE → ACKNOWLEDGED → CLEARED
```

- **setter 금지**: `setStatus(ACTIVE)` 대신 `activate()`
- 전이 검증: 허용 안 된 전이 시 예외
- 타임스탬프·변경자 자동 기록
- 단순: 엔티티 내 비즈니스 메서드 / 복잡: Spring StateMachine
- 적용: 주문 상태, 장애 상태, 승인 상태

---

## 10 공통코드 시스템 (CodeGroup + Code)

하드코딩·Enum 대신 DB 기반 공통코드. 런타임 추가/수정 가능 (재배포 불필요).

```
CodeGroup: groupCode "DEVICE_TYPE", name "장비 유형"
Code:      code "ROUTER", name "라우터", sortOrder, enabled
```

- 발전: Enum → DB 공통코드
- **FK 안 잡음**: 코드 삭제/비활성화 시 참조 무결성 문제. 코드값(String) 저장, 조회 시 조인. 정합성은 애플리케이션 레벨 검증
- **캐싱 필수**: Redis (TTL 30분~1시간). 변경 시 캐시 무효화

---

## 11 DTO 변환 패턴

Entity를 직접 API에 노출하지 않고 DTO로 변환.

| 방식 | 사용 시점 |
|------|----------|
| DTO 내 `from()` | 단순 1:1 매핑 |
| Mapper 클래스 | 복잡한 로직, 여러 엔티티 조합 |
| MapStruct | 필드 많은 경우 |

- N+1 방지: 필요한 필드만 추출, 중첩 DTO, Fetch Join / `@EntityGraph`
- Request DTO: 검증 어노테이션 (`@NotNull`, `@Size`)
- Response DTO: 불변, Builder
- **Entity 노출 금지**

---

## 12 Repository 패턴

데이터 접근 추상화, 영속성 기술 의존성 캡슐화.

| 계층 | 역할 | 의존성 |
|------|------|--------|
| Service | 비즈니스 로직 | Repository 인터페이스 |
| Repository | 데이터 접근 추상화 | 영속성 기술 |
| JpaRepository | 실제 DB 접근 | JPA |

동적 검색: null 파라미터는 조건에서 제외
```sql
WHERE (:typeCode IS NULL OR type_code = :typeCode)
  AND (:keyword IS NULL OR name LIKE %:keyword%)
```

---

## 13 Facade 패턴

여러 서비스 조합으로 복합 데이터 제공. Controller 복잡도 감소, 트랜잭션 경계 명확화.

| 상황 | 사용 |
|------|------|
| 여러 서비스 조합 | O |
| 복잡한 비즈니스 로직 | O |
| 트랜잭션 경계 | O |
| 단순 CRUD / 단일 서비스 | X |

예: `DashboardFacade` → DeviceService + FaultService + PerformanceService 조합 → DashboardSummaryResponse

---

## 14 프론트엔드 API 클라이언트

HTTP 클라이언트 추상화 + 공통 처리는 인터셉터. 서버 상태는 React Query 등.

| 인터셉터 | 역할 |
|---------|------|
| Request | 인증 토큰 추가, 공통 헤더 |
| Response (성공) | ApiResponse 래퍼에서 data 추출 |
| Response (실패) | 에러 정규화, 401 시 로그아웃 |

---

## 15 WebSocket 패턴

실시간 데이터는 WebSocket 푸시. 연결/재연결/메시지 처리 체계화.

### 15.1 백엔드

Handler(연결/해제/메시지), Session 관리, Broadcast, JSON 메시지 통일.

### 15.2 프론트엔드: 커스텀 훅 분리

관심사 분리(컴포넌트는 UI, 훅은 연결/상태), 재사용성, 테스트 용이.

```
useWebSocket(url, options)
├── connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
├── lastMessage / sendMessage / reconnect
└── useEffect(연결/정리), useRef(인스턴스), useCallback(핸들러)
```

### 15.3 자동 재연결 (지수 백오프)

```
끊김 → 1초 → 2초 → 4초 → ... (최대 30초)
```

- 최대 재시도 5~10회 후 포기 (무한 반복 방지)
- 성공 시 대기 시간 리셋

### 15.4 고려사항

- 끊김 감지 (heartbeat/ping-pong)
- 메시지 유실 처리 (시퀀스 번호, 재전송)
- 인증 (연결 시 토큰 전달)
- 다중 연결 관리 (여러 토픽 구독)

---

## 16 캐시 전략

자주 조회되지만 변경 적은 데이터 캐싱. 적중률 vs 정합성 균형.

| 데이터 | TTL |
|--------|-----|
| 공통코드 | 30분~1시간 |
| 설정 정보 | 1시간 |
| 사용자 세션 | 30분 |
| 집계 데이터 | 5분 |
| 목록 조회 | 1~5분 |

무효화: TTL 만료(기본) / 명시적 삭제(CUD 시) / 전체 무효화(구조 변경)
Spring: `@Cacheable`, `@CacheEvict`, `@CachePut`

---

## 17 요약

| 패턴 | 목적 | 핵심 키워드 |
|------|------|-------------|
| SOLID | 설계 원칙 | SRP, OCP, ISP, DIP |
| 버전 관리 | 릴리스 | MAJOR.MINOR.PATCH |
| 환경변수 | 설정 분리 | 하드코딩 금지 |
| DTO/VO | 데이터 전달 | Record, 불변, 재사용 |
| 문서화 | 코드 설명 | JavaDoc, Swagger, TSDoc |
| ApiResponse | 응답 통일 | success, code, data |
| Idempotency | 중복 방어 | Idempotency-Key, UPSERT, 낙관적 락 |
| Exception | 에러 처리 | Business vs Technical, GlobalExceptionHandler |
| Logging | 분석 가능성 | 카테고리, 표준 필드, traceId |
| Testing | 행동 검증 | 피라미드, AAA, 커버리지 혼합 |
| BaseEntity | 감사 필드 | createdAt, updatedAt |
| Factory Method | 객체 생성 | of(), from(), create() |
| State Machine | 상태 관리 | setter 금지, 전이 검증 |
| CommonCode | 코드 관리 | DB 기반, 캐시 |
| DTO 변환 | 계층 분리 | from(), Mapper |
| Repository | 영속성 추상화 | 인터페이스 분리 |
| Facade | 복합 로직 | 여러 서비스 조합 |
| API Client | HTTP 통신 | Axios + React Query |
| WebSocket | 실시간 | 훅 분리, 재연결 |
| Cache | 성능 | TTL, 무효화 |

---

**문서 끝**
