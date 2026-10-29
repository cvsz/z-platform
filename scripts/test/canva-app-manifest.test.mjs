import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = resolve(repoRoot, "apps/frontend/canva-app");
const manifest = JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8"));
const appSource = readFileSync(resolve(appRoot, "src/App.tsx"), "utf8");
const entrypoint = readFileSync(resolve(appRoot, "src/main.tsx"), "utf8");

test("Canva app manifest contains published SDK dependencies, not placeholder versions", () => {
  const dependencies = manifest.dependencies ?? {};
  assert.equal(dependencies["@canva/app-ui-kit"], "^5.14.0");
  assert.equal(dependencies["@canva/intents"], "^2.6.0");
  for (const [name, version] of Object.entries(dependencies)) {
    assert.notEqual(version, "^0.0.0", `${name} must not use an unpublished placeholder version`);
    assert.notEqual(version, "0.0.0", `${name} must not use an unpublished placeholder version`);
  }
  for (const removed of ["@canva/design", "@canva/user", "@canva/platform", "@canva/error", "@canva/asset"]) {
    assert.equal(dependencies[removed], undefined, `${removed} is unused by this app and must not block installs`);
  }
});

test("Canva Design Editor uses the documented intent and React root imports", () => {
  assert.match(entrypoint, /from '@canva\/intents\/design'/);
  assert.match(entrypoint, /from 'react-dom\/client'/);
  assert.match(entrypoint, /import '@canva\/app-ui-kit\/styles\.css'/);
  assert.match(entrypoint, /prepareDesignEditor\(designEditor\)/);
  assert.match(appSource, /export function App\(\)/);
  assert.doesNotMatch(appSource, /ReactDOM\.createRoot/);
});
