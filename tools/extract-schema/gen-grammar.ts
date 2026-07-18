/**
 * merged 스키마 → TextMate 문법(keepalived.tmLanguage.json) 생성.
 *
 * 단일 진실원(스키마)에서 블록/지시어 키워드를 뽑아 하이라이팅 규칙을 만든다.
 * 빌드 타임 전용. 결과는 커밋(마켓 게시에 필요).
 *
 * 설계 근거: docs/01-architecture/00-overview.md §2(S2), ADR-0005
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const schemaDir = join(__dirname, "..", "..", "schema");
const syntaxDir = join(__dirname, "..", "..", "syntaxes");

interface BlockLike {
  kind?: string;
  directives?: Record<string, unknown>;
}
interface SchemaLike {
  blocks: Record<string, BlockLike>;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildGrammar(schema: SchemaLike): unknown {
  const blockNames = new Set<string>();
  const directiveNames = new Set<string>();

  for (const [name, spec] of Object.entries(schema.blocks)) {
    blockNames.add(name);
    if (spec.directives) {
      for (const d of Object.keys(spec.directives)) directiveNames.add(d);
    }
  }
  // 지시어와 블록이 겹치면 블록 우선(블록 패턴이 먼저 매칭).
  for (const b of blockNames) directiveNames.delete(b);

  const blockAlt = [...blockNames].map(escapeRegex).sort((a, b) => b.length - a.length).join("|");
  const dirAlt = [...directiveNames].map(escapeRegex).sort((a, b) => b.length - a.length).join("|");

  return {
    $schema:
      "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    name: "keepalived",
    scopeName: "source.keepalived",
    patterns: [
      { include: "#comments" },
      { include: "#conditional" },
      { include: "#blocks" },
      { include: "#directives" },
      { include: "#strings" },
      { include: "#sequence" },
      { include: "#variables" },
      { include: "#ipcidr" },
      { include: "#numbers" },
      { include: "#booleans" },
    ],
    repository: {
      comments: {
        patterns: [
          { name: "comment.line.number-sign.keepalived", match: "#.*$" },
          { name: "comment.line.exclamation.keepalived", match: "!.*$" },
        ],
      },
      conditional: {
        // 줄 맨 앞 @id / @^id 조건부 접두사.
        match: "^\\s*(@\\^?[\\w-]+)",
        captures: { 1: { name: "keyword.control.conditional.keepalived" } },
      },
      blocks: {
        name: "keyword.control.block.keepalived",
        match: `\\b(${blockAlt})\\b`,
      },
      directives: {
        name: "keyword.other.directive.keepalived",
        match: `\\b(${dirAlt})\\b`,
      },
      strings: {
        name: "string.quoted.double.keepalived",
        begin: '"',
        end: '"',
        patterns: [{ name: "constant.character.escape.keepalived", match: "\\\\." }],
      },
      variables: {
        name: "variable.other.keepalived",
        match: "\\$[A-Za-z_][A-Za-z0-9_]*",
      },
      sequence: {
        // ~SEQ(start, end) 시퀀스 확장 (RFP §3.1).
        name: "support.function.sequence.keepalived",
        match: "~[A-Za-z_][\\w]*\\([^)]*\\)",
      },
      ipcidr: {
        patterns: [
          {
            // IPv4 (+옵션 CIDR prefix). numbers 보다 먼저 매칭돼야 함.
            name: "constant.numeric.ip.keepalived",
            match:
              "\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:/\\d{1,2})?\\b",
          },
          {
            // IPv6 (간이: hex 그룹 + 콜론, +옵션 prefix). 정밀 검증은 검증층 담당.
            name: "constant.numeric.ip.keepalived",
            match: "(?<![\\w:])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?:/\\d{1,3})?",
          },
        ],
      },
      numbers: {
        name: "constant.numeric.keepalived",
        match: "\\b\\d+(\\.\\d+)?\\b",
      },
      booleans: {
        name: "constant.language.boolean.keepalived",
        match: "\\b(?:true|false|on|off|yes|no)\\b",
      },
    },
  };
}

function main(): void {
  const schema = JSON.parse(
    readFileSync(join(schemaDir, "keepalived-spec.merged.json"), "utf8")
  ) as SchemaLike;
  const grammar = buildGrammar(schema);
  const out = join(syntaxDir, "keepalived.tmLanguage.json");
  writeFileSync(out, JSON.stringify(grammar, null, 2) + "\n", "utf8");
  console.log(`grammar written: ${out}`);
}

if (require.main === module) {
  main();
}
