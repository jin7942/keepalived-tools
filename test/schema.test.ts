/**
 * 스키마 로더·조회 헬퍼 행동 검증.
 * 설계 근거: docs/01-architecture/01-schema.md, CLAUDE.md §6 (AAA)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { getSchema } from "../core/schema/load.js";

test("loads merged schema with version", () => {
  const schema = getSchema();
  assert.equal(schema.version, "2.3.4");
});

test("vrrp_instance is a root block", () => {
  const schema = getSchema();
  assert.equal(schema.isRoot("vrrp_instance"), true);
});

test("real_server is not a root block", () => {
  const schema = getSchema();
  assert.equal(schema.isRoot("real_server"), false);
});

test("lb_algo resolves to lvs_sched via aliasOf", () => {
  // Arrange + Act
  const schema = getSchema();
  const canonical = schema.canonicalDirective("virtual_server", "lb_algo");
  const dir = schema.directive("virtual_server", "lb_algo");

  // Assert
  assert.equal(canonical, "lvs_sched");
  assert.ok(dir?.values?.includes("wrr"));
});

test("vrrp_track_file block resolves to track_file via aliasOf", () => {
  const schema = getSchema();
  const canonical = schema.canonicalBlock("vrrp_track_file");
  assert.equal(canonical, "track_file");
  // alias block 조회 시 canonical 정의를 돌려준다.
  assert.ok(schema.block("vrrp_track_file")?.directives?.file);
});

test("real_server is valid child of virtual_server", () => {
  const schema = getSchema();
  assert.equal(schema.isValidChild("real_server", "virtual_server"), true);
});

test("real_server is NOT valid child of vrrp_instance", () => {
  const schema = getSchema();
  assert.equal(schema.isValidChild("real_server", "vrrp_instance"), false);
});

test("url is valid child of HTTP_GET (depth 3)", () => {
  const schema = getSchema();
  assert.equal(schema.isValidChild("url", "HTTP_GET"), true);
});

test("priority directive has range 1..255", () => {
  const schema = getSchema();
  const dir = schema.directive("vrrp_instance", "priority");
  assert.equal(dir?.min, 1);
  assert.equal(dir?.max, 255);
  assert.equal(dir?.default, 100);
});
