# 01 - Schema Design (스키마 설계) — 재설계 v2

> `keepalived-spec.json` = 단일 진실원. 파서·검증·hover·completion 공유.
> keepalived **2.3.4 소스 직접 검증** 기반. 모든 추출 주장에 file:line 근거.

---

## 1 스키마의 역할

| 소비자 | 스키마에서 읽는 것 |
|--------|-------------------|
| Parser | 어떤 키워드가 블록(중첩 열림)인가/지시어인가 |
| 검증 구문층 | 미지시어, 잘못된 중첩, 블록/지시어 종류 오용 |
| 검증 타입층 | 값 타입·범위·enum·bool·ip |
| 검증 의미층 | 참조 관계(`ref` → 심볼 집합), 필수/중복/상호배타 |
| Hover | 설명·타입·허용값·기본값 |
| Completion | 현재 블록에서 가능한 지시어·enum 후보·블록 골격 |

---

## 2 실측한 블록 구조 (2.3.4)

### 2.1 최상위 블록 19종 (install_keyword_root)

| 서브시스템 | 블록 | file:line |
|-----------|------|-----------|
| VRRP | `vrrp_instance` | vrrp_parser.c:2326 |
| VRRP | `vrrp_sync_group` | vrrp_parser.c:2290 |
| VRRP | `vrrp_script` | vrrp_parser.c:2432 |
| VRRP | `vrrp_track_process` | vrrp_parser.c:2445 (조건부 `_WITH_TRACK_PROCESS_`) |
| VRRP | `garp_group` | vrrp_parser.c:2313 |
| VRRP | `track_group` | vrrp_parser.c:2280 |
| VRRP | `static_ipaddress`/`static_routes`/`static_rules` | 2285/2286/2287 (value block) |
| VRRP | `linkbeat_interfaces`, `interface_up_down_delays` | 2322, 2459 |
| LVS | `virtual_server` | check_parser.c:951 |
| LVS | `virtual_server_group` | check_parser.c:950 |
| LVS | `SSL` (전역) | check_parser.c:943 |
| BFD | `bfd_instance` | bfd_parser.c:510/517/523 (핸들러 3종, 프로세스별) |
| Trackers | `track_file` | track_file.c:538 |
| Trackers | `vrrp_track_file` | track_file.c:545 (deprecated 동의어) |
| Core | `global_defs` | global_parser.c:2601 (하위 블록 없음) |
| Core | `net_namespace` 외 단발 지시어들 | global_parser.c:2593~2600 |

주의:
- **`bfd_instance` 3회 등록** (프로세스별 핸들러 분기) → 추출 시 **이름 dedupe** 필요.
- `vrrp_track_file` = `track_file` 동의어(deprecated) → alias로 모델(§3.4).

### 2.2 중첩 트리 — 핵심 3블록

```
vrrp_instance (깊이 2)
├── (직접 지시어 ~70개: state, interface, priority, virtual_router_id, advert_int, ...)
├── authentication {        # sublevel: vrrp_parser.c 2418~2421
│   ├── auth_type
│   └── auth_pass
│   }
└── auth_hmac {             # sublevel: 2423~2429
    ├── key / active_key / time_window / anti_replay / mode
    }

virtual_server (깊이 3) ★ 최대 깊이
├── (직접 지시어: lb_algo, lvs_sched, lvs_method, protocol, persistence_*, quorum, ...)
└── real_server {           # sublevel: check_parser.c 1001~1025
    ├── (직접 지시어: weight, uthreshold, lthreshold, notify_up/down, retry, ...)
    └── <health checker> {  # install_checkers_keyword() @ check_parser.c:1024
        ├── TCP_CHECK / SMTP_CHECK / HTTP_GET / SSL_GET / DNS_CHECK
        ├── PING_CHECK / UDP_CHECK / FILE_CHECK / MISC_CHECK / BFD_CHECK(조건부)
        └── HTTP_GET 만 한 단계 더: url { path, digest, status_code, ... }  ← 깊이 3
        }
    }

vrrp_script (깊이 1)
└── script, interval, timeout, weight, rise, fall, user, init_fail  (sublevel 없음)
```

**최대 중첩 깊이 = 3** (`virtual_server > real_server > HTTP_GET > url`).
초안은 2로 가정 → AST·스키마·파서 모두 3 기준으로 재설계.

### 2.3 헬스체커 등록 = 크로스파일 콜그래프 (추출 최대 난점)

```
check_parser.c:1024  install_checkers_keyword()   ← real_server sublevel 안에서 호출
        └─> check_api.c:671  install_checkers_keyword() 정의
                ├─> install_misc_check_keyword()   (check_misc.c:205)
                ├─> install_tcp_check_keyword()    (check_tcp.c:84)
                ├─> install_http_check_keyword()   (check_http.c:986)
                ├─> install_ssl_check_keyword()    (check_http.c:992)
                ├─> install_dns_check_keyword()    (check_dns.c:547)
                ├─> install_smtp_check_keyword()   (check_smtp.c:284)
                ├─> install_ping_check_keyword()   (check_ping.c:169)
                ├─> install_udp_check_keyword()    (check_udp.c:185)
                ├─> install_file_check_keyword()   (check_file.c:131)
                └─> install_bfd_check_keyword()    (check_bfd.c:251, 조건부 _WITH_BFD_)
```

각 `install_*_check_keyword()`는:
```c
install_keyword("TCP_CHECK", &tcp_check_handler);   // 블록 이름
check_ptr = install_sublevel(VPP &current_checker);  // 중첩 열기
install_checker_common_keywords(true);               // 공통 지시어 주입
install_sublevel_end(check_ptr);                     // 중첩 닫기
```

→ **추출기는 단순 정규식이 아니라 콜그래프를 따라가야 한다.** `install_*()` 호출을
함수 정의로 펼치고, 소스 순서대로 sublevel 스택을 추적. 상세는 §4.

---

## 3 스키마 구조 (재설계)

초안 스키마는 `type/min/max/enum/ref`만 담아 의미 검증을 못 살림.
keepalived 실제 제약(필수·중복·상호배타·alias·조건부)을 담도록 어휘 확장.

```jsonc
{
  "version": "2.3.4",
  "blocks": {
    "vrrp_instance": {
      "kind": "block",
      "root": true,
      "description": "VRRP instance definition",
      "args": [                         // 블록 헤더 인자: vrrp_instance VI_1 {
        { "name": "name", "type": "string", "required": true,
          "defines": "vrrp_instances" } // ← 이 이름이 vrrp_instances 심볼 집합에 등록됨
      ],
      "directives": {
        "state": {
          "type": "enum", "values": ["MASTER", "BACKUP"],
          "maxOccurs": 1,
          "source": "manual",           // strcmp 체인 → 자동추출 불가 → override
          "description": "Initial VRRP state"
        },
        "priority": {
          "type": "int", "min": 1, "max": 255,
          "default": 100, "maxOccurs": 1,
          "source": "auto",             // read_unsigned_strvec 인자에서 추출
          "srcRef": "vrrp_parser.c:1057"
        },
        "virtual_router_id": {
          "type": "int", "min": 1, "max": 255, "required": true
        },
        "track_script": {
          "type": "ref", "refTo": "vrrp_scripts",   // 심볼 집합 이름
          "description": "Reference to a vrrp_script"
        }
      },
      "subBlocks": ["authentication", "auth_hmac"]    // 중첩 허용 블록 (이름 참조)
    },

    "virtual_server": {
      "kind": "block", "root": true,
      "directives": {
        "lvs_sched": {
          "type": "enum",
          "values": ["rr","wrr","lc","wlc","lblc","sh","mh","dh","fo","ovf","lblcr","sed","nq","twos"],
          "source": "auto",             // lvs_schedulers[] 배열에서 추출
          "srcRef": "check_parser.c:52",
          "aliasOf": null
        },
        "lb_algo": { "aliasOf": "lvs_sched" },         // 공유 핸들러 → alias
        "lvs_method": {
          "type": "enum", "values": ["NAT","DR","TUN"], "source": "manual"
        },
        "lb_kind": { "aliasOf": "lvs_method" },
        "protocol": { "type": "enum", "values": ["TCP","UDP","SCTP"],
                      "caseInsensitive": true, "source": "manual" }
      },
      "subBlocks": ["real_server"]
    },

    "real_server": {
      "kind": "block", "root": false,            // 최상위 아님
      "validParents": ["virtual_server"],         // 여기에만 올 수 있음 (구문 검증용)
      "args": [
        { "name": "ip", "type": "ip", "required": true },
        { "name": "port", "type": "port", "required": false }
      ],
      "subBlocks": ["TCP_CHECK","HTTP_GET","SSL_GET","MISC_CHECK","DNS_CHECK",
                    "SMTP_CHECK","PING_CHECK","UDP_CHECK","FILE_CHECK","BFD_CHECK"]
    },

    "HTTP_GET": {
      "kind": "block", "root": false,
      "validParents": ["real_server"],
      "subBlocks": ["url"]                         // 깊이 3
    }
  }
}
```

### 3.1 값 타입(type) 어휘

| 스키마 type | keepalived 원본 | 검증 | 자동추출 |
|-------------|-----------------|------|:---:|
| `bool` | `check_true_false()` (on/off/true/false/yes/no) | 토큰 멤버십 | O |
| `int` | INTEGER + min/max | 범위 | O (read_* 인자) |
| `timer` | TIMER (소수 초, μs 내부) | 양수·범위 | O |
| `port` | 1-65535 | 범위 | O |
| `string` | STRING / "quoted" | (선택) 길이 | 부분 |
| `ip` | IPADDR v4/v6 | inet_pton 형식 | O |
| `cidr` | IP/prefixlen | 형식 + prefix 0-32/0-128 | O |
| `enum` | 제한 토큰 | values 멤버십 | 배열만 O |
| `ref` | 다른 블록 이름 참조 | 의미층 존재 검사 | X (수작업) |

### 3.2 추가 제약 필드 (의미층 — 제품 차별점)

| 필드 | 의미 | 검증층 |
|------|------|--------|
| `required: true` | 블록 내 필수 지시어 | 의미 |
| `maxOccurs: 1` | 블록당 1회만 | 의미 |
| `defines: "<symbol>"` | 이 값/이름이 심볼 집합에 등록됨 | 의미 (심볼 수집) |
| `refTo: "<symbol>"` | 이 값이 가리키는 심볼 집합 | 의미 (참조 검사) |
| `validParents: [...]` | 이 블록이 올 수 있는 부모 | 구문 |
| `aliasOf: "<name>"` | 동일 의미의 다른 키워드 | 전 층 (정규화) |
| `caseInsensitive: true` | enum 대소문자 무시 (strcasecmp) | 타입 |
| `conditional: "<flag>"` | 조건부 컴파일 키워드 (정보용, 검증 X) | — |

### 3.3 출처 추적 필드 (`source`, `srcRef`)

각 지시어/타입에 추출 출처를 박제:
- `source: "auto"` — 콜그래프/핸들러에서 자동 추출. 재추출 시 갱신됨.
- `source: "manual"` — overrides.json 에서 온 수작업 값. 재추출이 안 건드림.
- `srcRef: "file.c:line"` — 자동 추출 근거 (디버깅·검증용).

### 3.4 alias 모델

`lvs_sched`/`lb_algo`가 같은 `lbalgo_handler` 공유(check_parser.c:960-961) → 동일 의미.
- 스키마는 한쪽을 정규형(canonical)으로, 다른 쪽은 `aliasOf` 로 가리킴.
- 파서·검증은 alias를 만나면 canonical로 정규화 후 처리.
- completion은 둘 다 후보로 제시하되 hover에 "alias of X" 표기.

---

## 4 추출 방식 (tools/extract-schema)

### 4.1 블록·중첩 = 콜그래프 추적 (자동)

단순 정규식 불가(§2.3). 다음 절차:

1. **install 함수 식별**: `install_keyword`, `install_keyword_root`, `install_keyword_quoted`,
   `install_keyword_conditional`, `install_sublevel`, `install_sublevel_end`.
2. **엔트리포인트부터 콜그래프 전개**: 키워드 등록 함수들을 호출 순서대로 펼침
   (예: `install_checkers_keyword()` → 각 `install_*_check_keyword()`).
3. **sublevel 스택 추적**: 소스 순서로 읽으며 `install_sublevel` push / `install_sublevel_end` pop.
   현재 스택 top = 지금 등록되는 지시어의 부모 블록.
4. **이름 dedupe**: `bfd_instance` 3회 등록 등은 1개로 병합.
5. **conditional/ifdef = 최대 집합**: `install_keyword_conditional`·`#ifdef` 키워드도 모두 포함
   (`conditional` 필드로 표시만). 근거: overview §7.

구현 수준: 완전한 C 파서는 과잉. **install_* 호출과 함수 정의·`#ifdef` 경계만 인식하는
경량 스캐너**로 충분(keepalived 등록부는 패턴이 규칙적). 단, 함수 호출 펼침은 필수.

### 4.2 타입·범위 = 핸들러 분석 (반자동, ~70-80%)

지시어 → 핸들러 함수 → 내부 `read_*` 콜사이트 인자에서 추출.

| 추출 | 근거 코드 | 자동 |
|------|----------|:---:|
| int min/max | `read_unsigned_strvec(strvec,1,&v, MIN, MAX, ...)` (vrrp_parser.c:1057) | O |
| timer min/max/소수자리 | `read_decimal_unsigned_strvec(strvec,1,&v, MIN, MAX, DIGITS, ...)` (1069) | O |
| port | `read_unsigned(port,&n, 1, 65535, ...)` (utils.c) | O |
| cidr prefix | `read_unsigned(p+1,&pl, 0, 32|128, ...)` (vrrp_ipaddress.c) | O |
| bool | `check_true_false()` 호출 감지 → 고정 6값 | O |
| enum(배열) | `static const char *lvs_schedulers[]={...}` (check_parser.c:52) | O |
| **enum(strcmp 체인)** | `if(!strcmp(str,"MASTER"))...` (vrrp_parser.c:834) | **X** |
| **enum(#ifdef 게이트)** | tunnel type ipip/gue/gre | **X** |
| string 길이 | `IFNAMSIZ` 등 named 상수 | 부분 |

### 4.3 상수 해석 (resolve-consts)

`read_*` 인자가 `VRRP_PRIO_OWNER` 같은 매크로면 숫자로 못 씀.
→ keepalived 헤더(`include/*.h`, `lib/*.h`)의 `#define` 을 미리 스캔해 **심볼 테이블** 구축.
→ `VRRP_PRIO_OWNER`→255, `TIMER_HZ`→1000000 등 치환. (간단한 산술 `255*TIMER_HZ`도 평가)

### 4.4 override 레이어 (초안 미해결 → 확정)

자동 추출이 약한 부분(strcmp enum, #ifdef enum, 의미 제약, 설명문)은 **`overrides.json`** 에 수작업.

```jsonc
// schema/overrides.json — 재추출이 절대 안 건드림
{
  "blocks": {
    "vrrp_instance": {
      "directives": {
        "state": { "type": "enum", "values": ["MASTER","BACKUP"], "source": "manual" }
      }
    }
  }
}
```

병합 규칙(`merge-overrides.ts`):
- 깊은 병합(deep merge). overrides 값이 spec 값을 **덮어씀**.
- 결과 = `keepalived-spec.merged.json` (런타임 로드 대상).
- spec.json(자동) / overrides.json(수작업) 분리 → 재추출이 보정분 보존.

### 4.5 설명문(hover) 추출 = manpage (보조)

`doc/man/man5/keepalived.conf.5.in` 은 **주석 달린 예제 설정** 형태
(`\fBpriority \fR100` + 위에 `#` 설명). 정형 타입/범위는 부정확하나 **설명문에는 적합**.
→ hover description 1차 소스. 타입/범위는 §4.2(핸들러)가 우선, manpage는 보강.

### 4.6 산출물·갱신

- `extract-schema` 실행 → `keepalived-spec.json` 생성 → `merge` → `merged.json`.
- 새 keepalived 버전 = 소스 교체 후 재실행. overrides.json은 수동 점검만.
- 추출 도구는 배포물 **미포함** (빌드 타임 전용).

---

## 5 주의 (실측 기반 함정)

- **조건부 컴파일**: 빌드 옵션별 키워드 차이 → 최대 집합 추출 (overview §7).
- **alias 누락 위험**: 공유 핸들러 자동 감지 가능하나, 의미 동일 여부는 검수 필요.
- **bfd_instance 다중 등록**: dedupe 안 하면 중복 블록.
- **enum 자동추출의 함정**: 배열형만 안전. strcmp형은 반드시 override로 검수
  (state/protocol/lvs_method 등 흔한 enum이 strcmp형 → 우선 보정 대상).
- 스키마는 생성물이지만 **검수 후 커밋·버전 관리**. spec/overrides/merged 셋 다 커밋.
