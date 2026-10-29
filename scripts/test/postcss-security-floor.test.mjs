import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const workspace = readFileSync(new URL("pnpm-workspace.yaml", root), "utf8");
const lockfile = readFileSync(new URL("pnpm-lock.yaml", root), "utf8");
const readPackage = (path) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8"));
const metricuiPackage = readPackage("apps/frontend/metricui-analytics/package.json");
const reuiPackage = readPackage("apps/frontend/reui-dashboard/package.json");

test("workspace override keeps PostCSS on the patched 8.x release line", () => {
  assert.match(workspace, /^  postcss: ["']?\^8\.5\.23["']?$/m);
  assert.match(lockfile, /^  postcss: \^8\.5\.23$/m);
});

test("Next.js nested PostCSS overrides are present in independently audited apps", () => {
  assert.equal(metricuiPackage.overrides?.next?.postcss, "^8.5.23");
  assert.equal(reuiPackage.overrides?.next?.postcss, "^8.5.23");
});

test("reui-dashboard does not retain the unused vulnerable Zod dependency", () => {
  assert.equal(Object.hasOwn(reuiPackage.dependencies || {}, "zod"), false);
});
