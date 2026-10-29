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
const gatewayLock = readPackage("services/ai-gateway/package-lock.json");
const zcWebPackage = readPackage("services/zc/webapp/frontend-src/package.json");
const zcWebLock = readPackage("services/zc/webapp/frontend-src/package-lock.json");

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

test("AI gateway npm lockfile resolves patched packages and matches its manifest", () => {
  const locked = gatewayLock.packages || {};
  assert.equal(locked["node_modules/body-parser"]?.version, "2.4.0");
  assert.equal(locked["node_modules/ip-address"]?.version, "10.7.4");
  assert.equal(locked["node_modules/proxy-addr"]?.version, "2.0.8");
  assert.equal(locked["node_modules/qs"]?.version, "6.17.1");
  assert.deepEqual(locked[""]?.dependencies, gatewayPackage.dependencies);
});

test("ZC web frontend pins patched Vite and vulnerable transitive dependency floors", () => {
  assert.equal(zcWebPackage.dependencies?.vite, "^6.4.4");
  assert.equal(zcWebPackage.overrides?.["baseline-browser-mapping"], "2.11.0");
  assert.equal(zcWebPackage.overrides?.browserslist, "4.28.7");
  assert.equal(zcWebPackage.overrides?.["nanoid@3"], "3.3.18");
  assert.equal(zcWebPackage.overrides?.postcss, "^8.5.23");
  assert.equal(zcWebPackage.overrides?.["source-map-js"], "^1.2.2");
});

test("ZC web frontend lockfile resolves patched versions and matches its manifest", () => {
  const locked = zcWebLock.packages || {};
  assert.equal(locked[""]?.dependencies?.vite, zcWebPackage.dependencies.vite);
  assert.equal(locked["node_modules/vite"]?.version, "6.4.4");
  assert.equal(locked["node_modules/baseline-browser-mapping"]?.version, "2.11.0");
  assert.equal(locked["node_modules/browserslist"]?.version, "4.28.7");
  assert.equal(locked["node_modules/nanoid"]?.version, "3.3.18");
  assert.ok((locked["node_modules/postcss"]?.version || "") >= "8.5.23");
  assert.ok((locked["node_modules/source-map-js"]?.version || "") >= "1.2.2");
});
