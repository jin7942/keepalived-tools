/**
 * hover/completion/format 행동 검증.
 * 설계 근거: docs/01-architecture, CLAUDE.md §6
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { hoverAt, completeAt, format } from "../core/features/index.js";

// ---- hover ----

test("hover: directive shows type and range", () => {
  const text = "vrrp_instance VI {\n priority 100\n}\n";
  // line 1, col over "priority" (col 1..9)
  const h = hoverAt(text, 1, 3);
  assert.ok(h);
  assert.ok(h!.markdown.includes("priority"));
  assert.ok(h!.markdown.includes("1..255"));
});

test("hover: block shows description", () => {
  const text = "vrrp_instance VI {\n}\n";
  const h = hoverAt(text, 0, 2);
  assert.ok(h);
  assert.ok(h!.markdown.toLowerCase().includes("block"));
});

test("hover: alias directive notes canonical", () => {
  const text = "virtual_server 10.0.0.1 80 {\n lb_algo wrr\n}\n";
  const h = hoverAt(text, 1, 3);
  assert.ok(h);
  assert.ok(h!.markdown.includes("alias of"));
});

test("hover: returns null off any keyword", () => {
  const text = "vrrp_instance VI {\n}\n";
  const h = hoverAt(text, 5, 0);
  assert.equal(h, null);
});

// ---- completion ----

test("completion: top level suggests root blocks", () => {
  const items = completeAt("", 0, 0);
  const labels = items.map((i) => i.label);
  assert.ok(labels.includes("vrrp_instance"));
  assert.ok(labels.includes("virtual_server"));
  assert.ok(items.every((i) => i.kind === "block"));
});

test("completion: inside vrrp_instance suggests its directives", () => {
  const text = "vrrp_instance VI {\n\n}\n";
  const items = completeAt(text, 1, 0);
  const labels = items.map((i) => i.label);
  assert.ok(labels.includes("state"));
  assert.ok(labels.includes("priority"));
  assert.ok(labels.includes("authentication")); // sub block
});

test("completion: enum values after directive keyword", () => {
  const text = "vrrp_instance VI {\n state \n}\n";
  const items = completeAt(text, 1, 7);
  const labels = items.map((i) => i.label);
  assert.deepEqual(labels.sort(), ["BACKUP", "MASTER"]);
});

// ---- format ----

test("format: reindents nested blocks with tabs", () => {
  const input = "vrrp_instance VI {\nstate MASTER\nauthentication {\nauth_type PASS\n}\n}\n";
  const out = format(input);
  const expected = [
    "vrrp_instance VI {",
    "\tstate MASTER",
    "\tauthentication {",
    "\t\tauth_type PASS",
    "\t}",
    "}",
    "",
  ].join("\n");
  assert.equal(out, expected);
});

test("format: preserves comments and blank lines", () => {
  const input = "# top\n\nglobal_defs {\nrouter_id X\n}\n";
  const out = format(input);
  assert.ok(out.includes("# top"));
  assert.ok(out.includes("\trouter_id X"));
  assert.ok(out.includes("\n\n"));
});

test("format: braces inside strings ignored", () => {
  const input = 'vrrp_script s {\nscript "echo {hi}"\n}\n';
  const out = format(input);
  assert.ok(out.includes('\tscript "echo {hi}"'));
  assert.ok(out.endsWith("}\n") || out.endsWith("}"));
});

test("format: idempotent", () => {
  const input = "vrrp_instance VI {\nstate MASTER\n}\n";
  const once = format(input);
  const twice = format(once);
  assert.equal(once, twice);
});
