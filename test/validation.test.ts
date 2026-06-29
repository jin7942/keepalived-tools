/**
 * 검증 4층 행동 검증.
 * 오탐 방지(정상인데 진단 안 뜸)를 핵심 가치로 다수 포함 (validation §8).
 * 설계 근거: docs/01-architecture/03-validation.md, CLAUDE.md §6
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateText, validateFiles } from "../core/validation/index.js";
import type { Diagnostic } from "../core/validation/index.js";

function codes(diags: Diagnostic[]): string[] {
  return diags.map((d) => d.code);
}
function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

// ---- 오탐 방지: 정상 설정은 무진단 ----

test("valid basic config produces no diagnostics", () => {
  const diags = validateText(fixture("valid-basic.conf"));
  assert.deepEqual(diags, [], `unexpected diagnostics: ${JSON.stringify(diags, null, 2)}`);
});

test("alias lb_algo/lb_kind normalized — no false enum error", () => {
  const diags = validateText("virtual_server 10.0.0.1 80 {\n lb_algo wrr\n lb_kind NAT\n}\n");
  assert.deepEqual(codes(diags), []);
});

test("protocol is case-insensitive (tcp accepted)", () => {
  const diags = validateText("virtual_server 10.0.0.1 80 {\n protocol tcp\n}\n");
  assert.deepEqual(codes(diags), []);
});

test("$VAR value is exempt from type check", () => {
  const diags = validateText("vrrp_instance VI {\n priority $PRIO\n}\n");
  assert.deepEqual(codes(diags), []);
});

// ---- 층1 구문 ----

test("syntax: real_server misplaced reports INVALID_PARENT", () => {
  const diags = validateText("vrrp_instance VI {\n real_server 1.2.3.4 80 {\n }\n}\n");
  assert.ok(codes(diags).includes("SYNTAX_INVALID_PARENT"));
});

test("syntax: unknown directive in known block", () => {
  const diags = validateText("vrrp_instance VI {\n bogus_dir 1\n}\n");
  assert.ok(codes(diags).includes("SYNTAX_UNKNOWN_DIRECTIVE"));
});

test("syntax: unknown block under unknown parent is silent (ADR-0009)", () => {
  const diags = validateText("totally_unknown_block {\n whatever 1\n}\n");
  assert.deepEqual(codes(diags), []);
});

test("syntax: unbalanced brace reported", () => {
  const diags = validateText("vrrp_instance VI {\n state MASTER\n");
  assert.ok(codes(diags).includes("SYNTAX_UNBALANCED_BRACE"));
});

// ---- 층2 타입 ----

test("type: priority out of range (300)", () => {
  const diags = validateText("vrrp_instance VI {\n priority 300\n}\n");
  assert.ok(codes(diags).includes("TYPE_OUT_OF_RANGE"));
});

test("type: state invalid enum", () => {
  const diags = validateText("vrrp_instance VI {\n state PRIMARY\n}\n");
  const d = diags.find((x) => x.code === "TYPE_INVALID_ENUM");
  assert.ok(d);
  assert.ok(d!.message.includes("MASTER"));
});

test("type: invalid IP in real_server header", () => {
  const diags = validateText(
    "virtual_server 10.0.0.1 80 {\n real_server 999.1.1.1 80 {\n }\n}\n"
  );
  assert.ok(codes(diags).includes("TYPE_INVALID_IP"));
});

test("type: port out of range", () => {
  const diags = validateText(
    "virtual_server 10.0.0.1 80 {\n real_server 1.2.3.4 70000 {\n }\n}\n"
  );
  assert.ok(codes(diags).includes("TYPE_INVALID_PORT"));
});

test("type: invalid bool", () => {
  const diags = validateText("global_defs {\n enable_script_security maybe\n}\n");
  assert.ok(codes(diags).includes("TYPE_INVALID_BOOL"));
});

// ---- 층3 의미 ----

test("semantic: undefined track_script ref", () => {
  const diags = validateText("vrrp_instance VI {\n track_script ghost\n}\n");
  assert.ok(codes(diags).includes("SEMANTIC_UNDEFINED_REF"));
});

test("semantic: defined track_script ref resolves", () => {
  const conf =
    'vrrp_script chk {\n script "x"\n}\nvrrp_instance VI {\n track_script chk\n}\n';
  const diags = validateText(conf);
  assert.ok(!codes(diags).includes("SEMANTIC_UNDEFINED_REF"));
});

test("semantic: missing required is silent by default (ADR-0011)", () => {
  const diags = validateText("vrrp_script chk {\n interval 2\n}\n");
  assert.ok(!codes(diags).includes("SEMANTIC_MISSING_REQUIRED"));
});

test("semantic: missing required reported when opted in", () => {
  // vrrp_script 는 script 필수.
  const diags = validateText("vrrp_script chk {\n interval 2\n}\n", { reportMissingRequired: true });
  assert.ok(codes(diags).includes("SEMANTIC_MISSING_REQUIRED"));
});

test("semantic: maxOccurs duplicate is warning not error", () => {
  const diags = validateText("vrrp_instance VI {\n priority 100\n priority 110\n}\n");
  const dup = diags.find((d) => d.code === "SEMANTIC_DUPLICATE_DIRECTIVE");
  assert.ok(dup);
  assert.equal(dup!.severity, "warning");
});

test("semantic: duplicate definition warning", () => {
  const diags = validateText("vrrp_script a {\n script \"x\"\n}\nvrrp_script a {\n script \"y\"\n}\n");
  assert.ok(codes(diags).includes("SEMANTIC_DUPLICATE_DEFINITION"));
});

test("semantic: unused is suppressed by default", () => {
  const diags = validateText('vrrp_script lonely {\n script "x"\n}\n');
  assert.ok(!codes(diags).includes("SEMANTIC_UNUSED"));
});

test("semantic: unused reported when opted in", () => {
  const diags = validateText('vrrp_script lonely {\n script "x"\n}\n', { reportUnused: true });
  assert.ok(codes(diags).includes("SEMANTIC_UNUSED"));
});

// ---- 층4 include ----

test("include: cross-file reference resolves with merged symbols", () => {
  const files = [
    { path: "/main.conf", text: "include scripts.conf\nvrrp_instance VI {\n track_script chk\n}\n", resolvedIncludes: ["/scripts.conf"] },
    { path: "/scripts.conf", text: 'vrrp_script chk {\n script "x"\n}\n', resolvedIncludes: [] },
  ];
  const result = validateFiles(files, "/main.conf");
  const mainDiags = result.get("/main.conf") ?? [];
  assert.ok(!codes(mainDiags).includes("SEMANTIC_UNDEFINED_REF"));
});

test("include: circular include detected", () => {
  const files = [
    { path: "/a.conf", text: "include b.conf\n", resolvedIncludes: ["/b.conf"] },
    { path: "/b.conf", text: "include a.conf\n", resolvedIncludes: ["/a.conf"] },
  ];
  const result = validateFiles(files, "/a.conf");
  const all = [...result.values()].flat();
  assert.ok(codes(all).includes("INCLUDE_CYCLE"));
});

test("include: not-found reported", () => {
  const files = [
    { path: "/a.conf", text: "include missing.conf\n", resolvedIncludes: ["/missing.conf"] },
  ];
  const result = validateFiles(files, "/a.conf");
  const all = [...result.values()].flat();
  assert.ok(codes(all).includes("INCLUDE_NOT_FOUND"));
});
