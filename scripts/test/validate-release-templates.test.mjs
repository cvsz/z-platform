import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const validator = join(root, "scripts", "validate-release-templates.mjs");
const schemaDir = join(root, "schemas", "release");

test("release templates validate against governance mappings", () => {
  const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated 5 release templates and 6 schemas/);
});

test("common schema enforces immutable revisions", async () => {
  const schema = JSON.parse(await readFile(join(schemaDir, "common.schema.json"), "utf8"));
  assert.equal(schema.$defs.fullCommitSha.pattern, "^[0-9a-f]{40}$");
  assert.match(schema.$defs.imageDigest.pattern, /@sha256/);
});

test("every record schema uses draft 2020-12 and declares a kind", async () => {
  const files = [
    "staging-inventory.schema.json",
    "external-verification.schema.json",
    "staging-review.schema.json",
    "operational-ownership.schema.json",
    "production-release-record.schema.json",
  ];
  for (const file of files) {
    const schema = JSON.parse(await readFile(join(schemaDir, file), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.ok(schema.properties.kind.const);
  }
});
