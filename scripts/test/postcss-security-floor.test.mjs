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
const gatewayPackage = readPackage("services/ai-gateway/package.json");

test("workspace overrides keep PostCSS and Express dependencies on patched floors", () => {
  assert.match(workspace, /^  postcss: ["']?\^8\.5\.23["']?$/m);
  assert.match(workspace, /^  ["']?body-parser@1["']?: ["']?1\.20\.9["']?$/m);
  assert.match(workspace, /^  ["']?body-parser@2["']?: ["']?2\.4\.0["']?$/m);
  assert.match(workspace, /^  ip-address: ["']?10\.7\.4["']?$/m);
  assert.match(workspace, /^  proxy-addr: ["']?2\.0\.8["']?$/m);
  assert.match(workspace, /^  qs: ["']?6\.17\.1["']?$/m);
  assert.match(lockfile, /^  postcss: \^8\.5\.23$/m);
  assert.match(lockfile, /^  ["']?body-parser@1["']?: 1\.20\.9$/m);
  assert.match(lockfile, /^  ["']?body-parser@2["']?: 2\.4\.0$/m);
  assert.match(lockfile, /^  ip-address: 10\.7\.4$/m);
  assert.match(lockfile, /^  proxy-addr: 2\.0\.8$/m);
  assert.match(lockfile, /^  qs: 6\.17\.1$/m);
});

test("Next.js nested PostCSS overrides are present in independently audited apps", () => {
  assert.equal(metricuiPackage.overrides?.next?.postcss, "^8.5.23");
  assert.equal(reuiPackage.overrides?.next?.postcss, "^8.5.23");
});

test("reui-dashboard does not retain the unused vulnerable Zod dependency", () => {
  assert.equal(Object.hasOwn(reuiPackage.dependencies || {}, "zod"), false);
});

test("AI gateway declares patched versions for vulnerable transitive dependencies", () => {
  assert.equal(gatewayPackage.overrides?.["body-parser"], "2.4.0");
  assert.equal(gatewayPackage.overrides?.["ip-address"], "10.7.4");
  assert.equal(gatewayPackage.overrides?.["proxy-addr"], "2.0.8");
  assert.equal(gatewayPackage.overrides?.qs, "6.17.1");
});
