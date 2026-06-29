/**
 * spec.json(자동 추출) + overrides.json(수작업) → merged.json (런타임 로드 대상).
 *
 * 빌드 타임 전용. 배포물 미포함.
 * 깊은 병합(deep merge), overrides 값이 spec 값을 덮어쓴다.
 *
 * 설계 근거: docs/01-architecture/01-schema.md §4.4, ADR-0008
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const schemaDir = join(__dirname, "..", "..", "schema");

type Json = Record<string, unknown>;

/**
 * 깊은 병합. plain object 끼리는 재귀 병합, 그 외(배열·원시값)는 src가 dst를 덮어씀.
 */
function deepMerge(dst: Json, src: Json): Json {
  const out: Json = { ...dst };
  for (const [key, srcVal] of Object.entries(src)) {
    const dstVal = out[key];
    if (isPlainObject(dstVal) && isPlainObject(srcVal)) {
      out[key] = deepMerge(dstVal, srcVal);
    } else {
      out[key] = srcVal;
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function loadJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json;
}

export function merge(): Json {
  const spec = loadJson(join(schemaDir, "keepalived-spec.json"));
  const overrides = loadJson(join(schemaDir, "overrides.json"));
  const merged = deepMerge(spec, overrides);
  // version 은 overrides 가 명시하면 우선, 아니면 spec.
  return merged;
}

function main(): void {
  const merged = merge();
  const outPath = join(schemaDir, "keepalived-spec.merged.json");
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  const blocks = isPlainObject(merged.blocks) ? Object.keys(merged.blocks).length : 0;
  console.log(`merged schema written: ${outPath} (${blocks} blocks)`);
}

// 직접 실행할 때만 파일 출력 (import 시엔 merge() 만 노출).
if (require.main === module) {
  main();
}
