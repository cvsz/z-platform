import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workflows = await Promise.all([
  readFile(fileURLToPath(new URL("../../.github/workflows/phase6-external-suite.yml", import.meta.url)), "utf8"),
  readFile(fileURLToPath(new URL("../../.github/workflows/external-staging-readiness.yml", import.meta.url)), "utf8"),
  readFile(fileURLToPath(new URL("../../.github/workflows/final-release-readiness.yml", import.meta.url)), "utf8"),
]);

for (const [name, workflow] of [
  ["phase6-external-suite", workflows[0]],
  ["external-staging-readiness", workflows[1]],
  ["final-release-readiness", workflows[2]],
]) {
  test(`${name} validates release SHA existence before checkout`, () => {
    const verifyIndex = workflow.indexOf("Verify release SHA exists in repository");
    const checkoutIndex = workflow.indexOf("actions/checkout@v5");
    assert.ok(verifyIndex >= 0);
    assert.ok(checkoutIndex > verifyIndex);
    assert.match(workflow, /https:\/\/api\.github\.com\/repos\/\$\{GITHUB_REPOSITORY\}\/commits\/\$\{RELEASE_SHA\}/);
    assert.match(workflow, /release_sha must reference a commit in \$\{GITHUB_REPOSITORY\}/);
  });
}
