import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const originMainLooseRef = new URL("../../.git/refs/remotes/origin/main", import.meta.url);
const originMainPackedRefs = new URL("../../.git/packed-refs", import.meta.url);
const originMainSha = existsSync(originMainLooseRef)
  ? readFileSync(originMainLooseRef, "utf8").trim()
  : readFileSync(originMainPackedRefs, "utf8")
      .split("\n")
      .find((line) => line.endsWith(" refs/remotes/origin/main"))
      ?.split(" ", 1)[0]
      ?.trim();

assert.ok(originMainSha, "origin/main SHA must be readable from local refs");

const stagingReadiness = await readFile(new URL("../../docs/operations/staging-readiness.md", import.meta.url), "utf8");
const evidenceMatrix = await readFile(new URL("../../docs/operations/phase-6-evidence-matrix.md", import.meta.url), "utf8");
const githubEnvironments = await readFile(new URL("../../docs/operations/github-environments.md", import.meta.url), "utf8");

test("current-head docs track the locally known origin/main SHA", () => {
  assert.match(stagingReadiness, new RegExp(originMainSha));
  assert.match(evidenceMatrix, new RegExp(originMainSha));
});

test("operator environment docs cover the staged review fields", () => {
  for (const marker of [
    "STAGING_REVIEWER",
    "INCIDENT_OWNER",
    "ESCALATION_ROUTE",
    "WATCH_WINDOW",
    "PRODUCTION_REVIEWER",
    "PRODUCTION_APPROVER",
  ]) {
    assert.match(githubEnvironments, new RegExp(marker));
    assert.match(stagingReadiness, new RegExp(marker));
    assert.match(evidenceMatrix, new RegExp(marker));
  }
});
