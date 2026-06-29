/**
 * Parser (lexer + 재귀하강) 행동 검증.
 * 설계 근거: docs/01-architecture/02-parser.md, CLAUDE.md §6 (AAA)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, tokenize } from "../core/parser/index.js";
import type { Block, Directive } from "../core/parser/index.js";

const fixturesDir = join(__dirname, "fixtures");
function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

// ---- Lexer ----

test("lexer: # and ! are both comments", () => {
  const toks = tokenize("# hash\n! bang\nstate MASTER\n");
  const words = toks.filter((t) => t.type === "WORD").map((t) => t.value);
  assert.deepEqual(words, ["state", "MASTER"]);
});

test("lexer: special chars inside quotes are literal", () => {
  const toks = tokenize('script "echo #not-comment !nor-this"\n');
  const str = toks.find((t) => t.type === "STRING");
  assert.equal(str?.value, "echo #not-comment !nor-this");
});

test("lexer: unterminated string stops at newline", () => {
  const toks = tokenize('auth_pass "abc\n');
  const str = toks.find((t) => t.type === "STRING");
  assert.equal(str?.value, "abc");
});

// ---- Parser: structure ----

test("parser: parses valid basic config without errors", () => {
  const { ast, errors } = parse(fixture("valid-basic.conf"));
  assert.equal(errors.length, 0);
  const keywords = ast.body.map((n) => (n.type === "block" ? n.keyword : (n as Directive).keyword));
  assert.ok(keywords.includes("global_defs"));
  assert.ok(keywords.includes("vrrp_instance"));
  assert.ok(keywords.includes("virtual_server"));
});

test("parser: block header args captured", () => {
  const { ast } = parse(fixture("valid-basic.conf"));
  const vs = ast.body.find((n) => n.type === "block" && n.keyword === "virtual_server") as Block;
  assert.equal(vs.args.length, 2);
  assert.equal(vs.args[0].text, "10.0.0.1");
  assert.equal(vs.args[0].kind, "ip");
  assert.equal(vs.args[1].text, "80");
});

test("parser: depth-3 nesting (virtual_server>real_server>HTTP_GET>url)", () => {
  const { ast } = parse(fixture("valid-basic.conf"));
  const vs = ast.body.find((n) => n.type === "block" && n.keyword === "virtual_server") as Block;
  const rs = vs.body.find((n) => n.type === "block" && n.keyword === "real_server") as Block;
  const httpGet = rs.body.find((n) => n.type === "block" && n.keyword === "HTTP_GET") as Block;
  const url = httpGet.body.find((n) => n.type === "block" && n.keyword === "url") as Block;
  assert.ok(url, "url block should be parsed at depth 3");
  const path = url.body.find((n) => n.type === "directive" && (n as Directive).keyword === "path") as Directive;
  assert.equal(path.values[0].text, "/health");
});

test("parser: directive values", () => {
  const { ast } = parse(fixture("valid-basic.conf"));
  const vi = ast.body.find((n) => n.type === "block" && n.keyword === "vrrp_instance") as Block;
  const state = vi.body.find((n) => n.type === "directive" && (n as Directive).keyword === "state") as Directive;
  assert.equal(state.values[0].text, "MASTER");
});

// ---- Parser: advanced syntax ----

test("parser: @ conditional prefix captured as condition", () => {
  const { ast } = parse("@high priority 170\n");
  const dir = ast.body[0] as Directive;
  assert.equal(dir.keyword, "priority");
  assert.equal(dir.condition, "high");
  assert.equal(dir.values[0].text, "170");
});

test("parser: @^ negated conditional", () => {
  const { ast } = parse("@^main state BACKUP\n");
  const dir = ast.body[0] as Directive;
  assert.equal(dir.condition, "^main");
  assert.equal(dir.keyword, "state");
});

test("parser: $VAR value classified as var", () => {
  const { ast } = parse("vrrp_instance VI { priority $PRIO }\n");
  const vi = ast.body[0] as Block;
  const prio = vi.body[0] as Directive;
  assert.equal(prio.values[0].kind, "var");
});

test("parser: ~SEQ value classified as seq", () => {
  const { ast } = parse("real_server 10.0.0.~SEQ(1,5) 80\n");
  const dir = ast.body[0] as Directive;
  assert.equal(dir.values[0].kind, "seq");
});

test("parser: include directive", () => {
  const { ast } = parse("include /etc/keepalived/conf.d/*.conf\n");
  const inc = ast.body[0];
  assert.equal(inc.type, "include");
  assert.equal((inc as { glob: string }).glob, "/etc/keepalived/conf.d/*.conf");
});

// ---- Parser: error recovery ----

test("parser: unclosed block reports error but still builds AST", () => {
  const { ast, errors } = parse("vrrp_instance VI {\n  state MASTER\n");
  assert.ok(errors.some((e) => e.code === "SYNTAX_UNBALANCED_BRACE"));
  const vi = ast.body[0] as Block;
  assert.equal(vi.keyword, "vrrp_instance");
  assert.ok(vi.body.length >= 1); // state MASTER 는 복구돼 들어감
});

test("parser: stray closing brace reported", () => {
  const { errors } = parse("state MASTER\n}\n");
  assert.ok(errors.some((e) => e.code === "SYNTAX_UNBALANCED_BRACE"));
});

test("parser: brace on next line", () => {
  const { ast, errors } = parse("vrrp_instance VI\n{\n state MASTER\n}\n");
  assert.equal(errors.length, 0);
  const vi = ast.body[0] as Block;
  assert.equal(vi.type, "block");
  assert.equal(vi.body.length, 1);
});

// ---- M2 회귀: NEWLINE 토큰 end 위치 ----

test("lexer: NEWLINE end is next line col 0", () => {
  const toks = tokenize("x\ny");
  const nl = toks.find((t) => t.type === "NEWLINE");
  assert.ok(nl);
  assert.equal(nl!.start.line, 0);
  assert.equal(nl!.end.line, 1);
  assert.equal(nl!.end.col, 0);
});

// ---- H1 회귀: 선두 BOM 스킵 ----

test("lexer: leading BOM does not corrupt first keyword", () => {
  const ast = parse("﻿global_defs {\n}\n").ast;
  assert.equal(ast.body[0].type, "block");
  assert.equal((ast.body[0] as Block).keyword, "global_defs");
});

// ---- 견고성 회귀: CRLF / 멀티바이트 ----

test("parser: CRLF line endings parse like LF", () => {
  const ast = parse("vrrp_instance VI {\r\n priority 100\r\n}\r\n").ast;
  assert.equal(ast.body[0].type, "block");
  assert.equal((ast.body[0] as Block).keyword, "vrrp_instance");
});

test("parser: multibyte argument counted in UTF-16 columns", () => {
  const ast = parse("vrrp_instance 日本 {\n priority 100\n}\n").ast;
  const blk = ast.body[0] as Block;
  assert.equal(blk.args[0].text, "日本");
  // '日本' = 2 UTF-16 units → 다음 줄 priority 들여쓰기 col 은 1.
  const dir = blk.body[0] as Directive;
  assert.equal(dir.range.start.col, 1);
});
