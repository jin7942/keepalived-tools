/**
 * hover/completion/format 행동 검증.
 * 설계 근거: docs/01-architecture, CLAUDE.md §6
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { hoverAt, completeAt, format, definitionAt, quickFixesFor, outline, includeLinks } from "../core/features/index.js";

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

// ---- definition (go-to-definition) ----

test("definition: track_script ref resolves to vrrp_script header", () => {
  const text = 'vrrp_script chk {\n script "x"\n}\nvrrp_instance VI {\n track_script chk\n}\n';
  // cursor on "chk" in the track_script line (line 4).
  const def = definitionAt(text, 4, 14);
  assert.ok(def, "expected a definition");
  assert.equal(def!.name, "chk");
  assert.equal(def!.range.start.line, 0); // vrrp_script chk header.
});

test("definition: cursor not on a ref returns null", () => {
  const text = "vrrp_instance VI {\n priority 100\n}\n";
  assert.equal(definitionAt(text, 1, 3), null);
});

test("definition: undefined ref returns null", () => {
  const text = "vrrp_instance VI {\n track_script ghost\n}\n";
  assert.equal(definitionAt(text, 1, 15), null);
});

// ---- quick-fix (did you mean) ----

test("quickfix: enum typo suggests nearest valid value", () => {
  // state MASTERR -> MASTER
  const text = "vrrp_instance VI {\n state MASTERR\n}\n";
  const fixes = quickFixesFor(text, "TYPE_INVALID_ENUM", "MASTERR", 1, 7);
  assert.ok(fixes.some((f) => f.replacement === "MASTER"));
});

test("quickfix: far-off enum value yields no noisy suggestion", () => {
  const text = "vrrp_instance VI {\n state ZZZZZZZZ\n}\n";
  const fixes = quickFixesFor(text, "TYPE_INVALID_ENUM", "ZZZZZZZZ", 1, 7);
  assert.deepEqual(fixes, []);
});

test("quickfix: unknown directive typo suggests nearest member", () => {
  // priorty -> priority (vrrp_instance has priority directive)
  const text = "vrrp_instance VI {\n priorty 100\n}\n";
  const fixes = quickFixesFor(text, "SYNTAX_UNKNOWN_DIRECTIVE", "priorty", 1, 1);
  assert.ok(fixes.some((f) => f.replacement === "priority"));
});

// ---- outline (document symbols) ----

test("outline: top-level blocks with header detail", () => {
  const text = "global_defs {\n}\nvrrp_instance VI_1 {\n priority 100\n}\n";
  const syms = outline(text);
  assert.equal(syms.length, 2);
  assert.equal(syms[0].name, "global_defs");
  assert.equal(syms[1].name, "vrrp_instance");
  assert.equal(syms[1].detail, "VI_1");
});

test("outline: nested blocks become children", () => {
  const text = "virtual_server 10.0.0.1 80 {\n real_server 10.0.0.2 80 {\n }\n}\n";
  const syms = outline(text);
  assert.equal(syms[0].name, "virtual_server");
  assert.equal(syms[0].detail, "10.0.0.1 80");
  assert.equal(syms[0].children.length, 1);
  assert.equal(syms[0].children[0].name, "real_server");
});

test("outline: directives excluded, only blocks", () => {
  const text = "global_defs {\n router_id X\n}\n";
  const syms = outline(text);
  assert.equal(syms.length, 1);
  assert.equal(syms[0].children.length, 0);
});

// ---- include links ----

test("includeLinks: extracts glob and range from include directives", () => {
  const text = 'include /etc/keepalived/conf.d/*.conf\nglobal_defs {\n}\n';
  const links = includeLinks(text);
  assert.equal(links.length, 1);
  assert.equal(links[0].glob, "/etc/keepalived/conf.d/*.conf");
  assert.equal(links[0].range.start.line, 0);
});

test("includeLinks: none when no include", () => {
  assert.deepEqual(includeLinks("global_defs {\n}\n"), []);
});

// ---- 포맷터 안전성 회귀 (공식 샘플) ----

import { readdirSync as _readdirSync } from "node:fs";
import { readFileSync as _readFileSync } from "node:fs";
import { join as _join } from "node:path";
import { parse as _parse } from "../core/parser/index.js";

const _SAMPLES = _join(__dirname, "fixtures", "samples");

/** 포맷 전후 내용 보존 검증용: 비공백 토큰 시그니처. */
function tokenSig(text: string): string {
  const toks: string[] = [];
  const walk = (body: any[]) => {
    for (const c of body) {
      if (c.type === "block") {
        toks.push("B:" + c.keyword, ...c.args.map((a: any) => a.text));
        walk(c.body);
        toks.push("}");
      } else if (c.type === "directive") {
        toks.push("D:" + c.keyword, ...c.values.map((v: any) => v.text));
      } else if (c.type === "include") {
        toks.push("I:" + c.glob);
      }
    }
  };
  walk(_parse(text).ast.body);
  return toks.join("|");
}

for (const file of _readdirSync(_SAMPLES).filter((f) => f.endsWith(".conf"))) {
  test(`formatter idempotent + content-preserving: ${file}`, () => {
    const orig = _readFileSync(_join(_SAMPLES, file), "utf8");
    const once = format(orig);
    assert.equal(format(once), once, `not idempotent: ${file}`);
    assert.equal(tokenSig(once), tokenSig(orig), `content altered: ${file}`);
  });
}
