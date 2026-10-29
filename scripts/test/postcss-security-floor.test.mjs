import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const workspace = readFileSync(new URL("pnpm-workspace.yaml", root), "utf8");
const lockfile = readFileSync(new URL("pnpm-lock.yaml", root), "utf8");
const metricuiPackage = JSON.parse(
  readFileSync(new URL("apps/frontend/metricui-analytics/package.json", root), "utf8"),
);

test("workspace override keeps PostCSS on the patched 8.x release line", () => {
  assert.match(workspace, /^  postcss: ["']?\^8\.5\.23["']?$/m);
  assert.match(lockfile, /^  postcss: \^8\.5\.23$/m);
});

test("Next.js nested PostCSS override is present in the independently audited app", () => {
  assert.equal(metricuiPackage.overrides?.next?.postcss, "^8.5.23");
});
