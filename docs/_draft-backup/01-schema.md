# 01 - Schema Design (스키마 설계)

> `keepalived-spec.json` = 단일 진실원. 파서·검증·hover·자동완성이 공유.
> keepalived 소스에서 자동 추출 + 타입 보정으로 생성.

---

## 1 스키마의 역할

| 소비자 | 스키마에서 읽는 것 |
|--------|-------------------|
| Parser | 어떤 키워드가 블록인가/지시어인가 |
| 검증 구문층 | 알 수 없는 지시어, 잘못된 중첩 판정 |
| 검증 타입층 | 값 타입·범위·enum |
| 검증 의미층 | 참조 관계 (어떤 지시어가 어떤 블록을 참조하는가) |
| Hover | 설명·타입·허용값 |
| Completion | 현재 블록에서 가능한 지시어·enum 후보 |

→ 이 모든 정보를 한 JSON에 담는다.

---

## 2 스키마 구조 (초안)

```jsonc
{
  "version": "keepalived 2.x",        // 추출 대상 keepalived 버전
  "blocks": {
    "vrrp_instance": {
      "kind": "block",
      "root": true,                    // 최상위 블록 여부
      "description": "VRRP instance definition",
      "args": [                        // 블록 헤더 인자 (vrrp_instance VI_1 { ...)
        { "name": "name", "type": "string", "required": true }
      ],
      "directives": {
        "state": {
          "type": "enum",
          "values": ["MASTER", "BACKUP"],
          "description": "Initial VRRP state"
        },
        "priority": {
          "type": "int",
          "min": 1, "max": 255,
          "description": "VRRP priority"
        },
        "interface": { "type": "string", "description": "Network interface" },
        "virtual_router_id": { "type": "int", "min": 1, "max": 255 },
        "track_script": {
          "type": "ref",               // 참조 타입 (의미 검증용)
          "refTo": "vrrp_script",       //   vrrp_script 블록 이름을 참조
          "description": "Reference to a vrrp_script block"
        }
      },
      "subBlocks": {                    // 중첩 가능한 하위 블록
        "virtual_ipaddress": { "$ref": "#/blocks/virtual_ipaddress" }
      }
    },
    "virtual_server": {
      "kind": "block", "root": true,
      "directives": {
        "lvs_sched": { "type": "enum", "values": ["rr","wrr","lc","wlc","sh","mh","dh","fo"] },
        "lvs_method": { "type": "enum", "values": ["NAT","DR","TUN"] },
        "protocol": { "type": "enum", "values": ["TCP","UDP","SCTP"] }
      },
      "subBlocks": {
        "real_server": { "$ref": "#/blocks/real_server" }   // real_server는 여기에만
      }
    }
  }
}
```

### 2.1 값 타입(type) 어휘

조사한 keepalived 값 타입을 스키마 어휘로 매핑.

| 스키마 type | keepalived 원본 | 검증 |
|-------------|-----------------|------|
| `bool` | BOOL (on/off/true/false/yes/no) | 허용 토큰 검사 |
| `int` | INTEGER | min/max |
| `timer` | TIMER (소수 초) | 숫자·양수 |
| `port` | PORT | 1-65535 |
| `string` | STRING / "quoted" | — |
| `ip` | IPADDR (v4/v6) | IP 형식 |
| `cidr` | MASK (/24) | CIDR 형식 |
| `enum` | (제한된 토큰 집합) | values 멤버십 |
| `ref` | (다른 블록 이름 참조) | 의미층에서 존재 검사 |

---

## 3 추출 방식 (tools/extract-schema)

### 3.1 자동 추출 — 지시어·중첩

keepalived 소스의 `install_keyword*()` 호출을 정적 파싱.

| 추출 대상 | 소스 근거 |
|-----------|----------|
| 지시어 이름 | `install_keyword("state", ...)` 첫 인자 |
| 최상위 블록 | `install_keyword_root("vrrp_instance", ...)` |
| 중첩 관계 | `install_sublevel()` / `install_sublevel_end()` 짝 + 호출 순서 |
| quoted 여부 | `install_keyword_quoted(...)` |

대상 파일:
- `keepalived/core/global_parser.c`
- `keepalived/vrrp/vrrp_parser.c`
- `keepalived/check/check_parser.c`
- `keepalived/bfd/bfd_parser.c`
- `keepalived/vrrp/vrrp_ip_rule_route_parser.c`

### 3.2 반자동 — 값 타입

타입은 핸들러 함수(`vrrp_prio_handler` 등) 내부의 `read_int()`, `read_timer()`, `read_unsigned()` 등
호출로 결정됨. 자동 100%는 불가.

전략:
1. 핸들러명 → 휴리스틱 매핑 (예: `*_prio_*` → int, `*_int_handler` → string interface)
2. manpage `keepalived.conf(5)`로 타입·범위·enum 보강
3. 수작업 검수 (특히 enum 값, min/max)

GPL 채택으로 핸들러 로직을 직접 참조할 수 있어 정확도 확보 (`00-planning/02-license.md`).

### 3.3 산출물

- `tools/extract-schema` 실행 → `schema/keepalived-spec.json` 생성/갱신.
- keepalived 새 버전 대응 = 소스 교체 후 재실행.
- 추출 도구는 익스텐션 배포물에 **미포함** (빌드 타임 전용).

---

## 4 주의

- 조건부 컴파일(`#ifdef`)로 일부 키워드가 빌드 옵션에 따라 달라짐 → 추출 시 전체 포함(최대 집합) 권장.
- 스키마는 생성물이지만 **수작업 보정분이 섞이므로** 레포에 커밋하고 버전 관리.
- 보정 내역은 추출 스크립트가 덮어쓰지 않도록 "override" 레이어 분리 검토 (S1 단계에서 확정).
