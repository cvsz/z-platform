import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "../generate-sbom.mjs");

test("SBOM package IDs remain unique for duplicate, colliding and unnamed manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "zplatform-sbom-"));
  try {
    const manifests = [
      ["apps/a/package.json", { name: "@org/example", version: "1.0.0" }],
      ["apps/b/package.json", { name: "@org/example", version: "2.0.0" }],
      ["services/c/package.json", { name: "org-example", version: "3.0.0" }],
      ["services/z-prov/package.json", { dependencies: { supabase: "^2.113.0" } }],
    ];
    for (const [path, manifest] of manifests) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), JSON.stringify(manifest));
    }
    const run = () => {
      const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };
    const first = run();
    const second = run();
    assert.equal(first.packages.length, manifests.length);
    const ids = first.packages.map((p) => p.SPDXID);
    assert.equal(new Set(ids).size, manifests.length);
    assert.ok(ids.every((id) => /^SPDXRef-Package-[A-Za-z0-9.-]+$/.test(id)));
    assert.deepEqual(ids, second.packages.map((p) => p.SPDXID));
    assert.ok(first.packages.some((p) => p.name === "services/z-prov"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
