import assert from "node:assert/strict";
import test from "node:test";

import { toSpdxPackage } from "../generate-sbom.mjs";

test("preserves a valid declared package name and version", () => {
  const result = toSpdxPackage({ name: "@zeaz/example", version: "1.2.3" }, "packages/example/package.json");

  assert.equal(result.name, "@zeaz/example");
  assert.equal(result.versionInfo, "1.2.3");
  assert.equal(result.SPDXID, "SPDXRef-Package--zeaz-example");
});

test("uses a deterministic path-based name when package name is missing", () => {
  const result = toSpdxPackage({ version: "0.1.0" }, "apps/unnamed/package.json");

  assert.equal(result.name, "unnamed-apps-unnamed-package.json");
  assert.equal(result.versionInfo, "0.1.0");
  assert.equal(result.SPDXID, "SPDXRef-Package-unnamed-apps-unnamed-package.json");
});

test("uses a safe fallback for blank or non-string package names", () => {
  const blank = toSpdxPackage({ name: "   " }, "tools/blank/package.json");
  const nonString = toSpdxPackage({ name: 42 }, "tools/non-string/package.json");

  assert.equal(blank.name, "unnamed-tools-blank-package.json");
  assert.equal(nonString.name, "unnamed-tools-non-string-package.json");
  assert.notEqual(blank.SPDXID, nonString.SPDXID);
});
