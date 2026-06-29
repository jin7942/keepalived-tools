/**
 * keepalived 스키마 타입 정의.
 *
 * 단일 진실원(`keepalived-spec.merged.json`)의 형태를 TS 타입으로 박제한다.
 * 파서·검증·hover·completion 모두 이 타입을 통해 스키마를 읽는다.
 *
 * 설계 근거: docs/01-architecture/01-schema.md §3
 */

/** 값 타입 어휘 (schema 문서 §3.1). */
export type ValueType =
  | "bool"
  | "int"
  | "timer"
  | "port"
  | "string"
  | "ip"
  | "cidr"
  | "enum"
  | "ref";

/** 추출 출처 (schema 문서 §3.3). */
export type Source = "auto" | "manual";

/**
 * 지시어(directive) 정의.
 * 블록 안에서 `keyword value...` 형태로 쓰이는 단일 지시어.
 */
export interface DirectiveSpec {
  /** 값 타입. alias 전용 항목이면 생략 가능. */
  type?: ValueType;
  /** int/timer/port 범위 하한. */
  min?: number;
  /** int/timer/port 범위 상한. */
  max?: number;
  /** enum 허용값. */
  values?: string[];
  /** enum 대소문자 무시 비교 (strcasecmp 모방). */
  caseInsensitive?: boolean;
  /** ref 타입이 가리키는 심볼 집합 이름. */
  refTo?: string;
  /** 이 지시어 값이 등록되는 심볼 집합 이름. */
  defines?: string;
  /** 블록 내 필수 여부. */
  required?: boolean;
  /** 블록당 최대 출현 횟수. */
  maxOccurs?: number;
  /** 기본값 (hover 표기용). */
  default?: string | number | boolean;
  /** 동일 의미의 정규형 키워드 이름. 있으면 이 항목은 alias. */
  aliasOf?: string;
  /** 조건부 컴파일 플래그 (정보용, 검증 안 함). */
  conditional?: string;
  /** deprecated 키워드 여부. */
  deprecated?: boolean;
  /** hover 설명문. */
  description?: string;
  /** 추출 출처. */
  source?: Source;
  /** 자동 추출 근거 (file:line). */
  srcRef?: string;
}

/**
 * 블록 헤더 인자 정의.
 * 예: `vrrp_instance VI_1 {` 의 `VI_1`, `real_server 10.0.0.1 80 {` 의 IP/port.
 */
export interface ArgSpec {
  /** 인자 이름 (식별용). */
  name: string;
  /** 인자 값 타입. */
  type: ValueType;
  /** 필수 여부. */
  required?: boolean;
  /** 이 인자가 등록되는 심볼 집합 이름. */
  defines?: string;
  /** enum 허용값. */
  values?: string[];
  /** 설명. */
  description?: string;
}

/**
 * 블록(block) 정의.
 * 중첩(`{ }`)을 여는 키워드.
 */
export interface BlockSpec {
  kind: "block";
  /** 최상위(install_keyword_root) 블록 여부. */
  root?: boolean;
  /** 이 블록이 올 수 있는 부모 블록 이름들 (root=false 일 때 구문 검증용). */
  validParents?: string[];
  /** 블록 헤더 인자. */
  args?: ArgSpec[];
  /** 직접 포함하는 지시어. */
  directives?: Record<string, DirectiveSpec>;
  /** 중첩 허용 블록 이름들. */
  subBlocks?: string[];
  /**
   * 자유형 블록: 본문이 정형 지시어가 아니라 임의 이름/항목 나열.
   * (예: `track_script { name1 name2 }`) 본문 미지시어 검사를 스킵한다.
   */
  freeform?: boolean;
  /** 동일 의미의 정규형 블록 이름. 있으면 이 블록은 alias. */
  aliasOf?: string;
  /** 조건부 컴파일 플래그. */
  conditional?: string;
  /** deprecated 여부. */
  deprecated?: boolean;
  /** hover 설명문. */
  description?: string;
  /** 추출 출처. */
  source?: Source;
  /** 자동 추출 근거. */
  srcRef?: string;
}

/** 스키마 전체. */
export interface Schema {
  /** 추출 기준 keepalived 버전. */
  version: string;
  /** 블록 정의 맵 (키 = 블록 이름). */
  blocks: Record<string, BlockSpec>;
}
