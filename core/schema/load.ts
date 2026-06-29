/**
 * merged 스키마 JSON 로드 진입점.
 *
 * 번들 시 esbuild 가 JSON 을 정적으로 인라인한다(`loader: json`). 런타임 fs 불필요.
 * 테스트(tsx)에서도 resolveJsonModule 로 동일하게 import 된다.
 *
 * core 가 직접 fs 를 건드리지 않게(ADR-0002) JSON import 만 사용한다.
 */

import mergedJson from "../../schema/keepalived-spec.merged.json";
import type { Schema } from "./types.js";
import { createSchemaIndex, SchemaIndex } from "./index.js";

let cached: SchemaIndex | undefined;

/** 빌드에 인라인된 merged 스키마의 SchemaIndex 를 반환 (싱글턴). */
export function getSchema(): SchemaIndex {
  if (!cached) {
    cached = createSchemaIndex(mergedJson as Schema);
  }
  return cached;
}
