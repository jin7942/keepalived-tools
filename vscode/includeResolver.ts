/**
 * include glob resolve (어댑터 책임, ADR-0010).
 *
 * core 는 fs 비의존이라 어댑터가 glob 을 실제 파일 경로로 푼다.
 * 진단 다중파일 수집과 DocumentLink(클릭 이동)가 공유한다.
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";

const MAX_WALK_DEPTH = 16; // 심링크 순환·폭주 방지.

/** glob 을 baseDir 기준 절대경로로 만들고 확장. glob 문자 없으면 단일 경로. */
export async function resolveGlob(baseDir: string, glob: string): Promise<string[]> {
  const abs = path.isAbsolute(glob) ? glob : path.join(baseDir, glob);
  return expandGlob(abs);
}

/**
 * glob 확장. 지원: `dir/*.conf`(단일), `dir/** /*.conf`(재귀),
 * `dir/** /sub/*.conf`(중간 세그먼트 보존).
 * 전체 경로를 정규식으로 변환해 매칭하므로 `**` 이후 구조도 존중한다(M4).
 */
export async function expandGlob(pattern: string): Promise<string[]> {
  if (!pattern.includes("*")) return [pattern];

  // glob 문자 없는 최장 선두 디렉토리를 워크 루트로.
  // 첫 `*` 앞에서 마지막 경로 구분자까지가 고정 디렉토리.
  const firstStar = pattern.indexOf("*");
  const lastSep = pattern.lastIndexOf("/", firstStar);
  const root = lastSep > 0 ? pattern.slice(0, lastSep) : "/";
  const re = fullGlobToRegExp(pattern);

  const recursive = pattern.includes("**");
  return walkDir(root, re, recursive, new Set(), 0);
}

/** 전체 경로 glob → 정규식. `**`=슬래시 포함 임의, `*`=슬래시 제외 임의. */
function fullGlobToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*"; // ** : 디렉토리 경계 넘어 매칭.
        i++;
      } else {
        re += "[^/]*"; // * : 한 세그먼트 내.
      }
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

/**
 * 디렉토리 재귀 워크. full path 가 re 에 맞는 파일 수집.
 * 심링크 순환은 realpath 방문 집합으로 차단(M4). 깊이 상한도 유지.
 */
async function walkDir(
  dir: string,
  re: RegExp,
  recursive: boolean,
  visited: Set<string>,
  depth: number
): Promise<string[]> {
  if (depth > MAX_WALK_DEPTH) return [];

  let real: string;
  try {
    real = await fs.realpath(dir);
  } catch {
    return [];
  }
  if (visited.has(real)) return []; // 심링크 순환 차단.
  visited.add(real);

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    let isDir = e.isDirectory();
    if (e.isSymbolicLink()) {
      try {
        isDir = (await fs.stat(full)).isDirectory();
      } catch {
        continue; // 깨진 심링크.
      }
    }
    if (isDir) {
      if (recursive) out.push(...(await walkDir(full, re, recursive, visited, depth + 1)));
    } else if (re.test(full)) {
      out.push(full);
    }
  }
  return out.sort();
}
