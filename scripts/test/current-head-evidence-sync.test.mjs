import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const gitPath = fileURLToPath(new URL("../../.git", import.meta.url));

function resolveCommonGitDir() {
  if (existsSync(gitPath) && lstatSync(gitPath).isDirectory()) {
    return gitPath;
  }

  const gitdir = readFileSync(gitPath, "utf8").trim().replace(/^gitdir:\s*/, "");
  const commondirPath = resolve(gitdir, "commondir");
  if (existsSync(commondirPath)) {
    return resolve(gitdir, readFileSync(commondirPath, "utf8").trim());
  }
  return gitdir;
}

const commonGitDir = resolveCommonGitDir();
const originMainLooseRef = resolve(commonGitDir, "refs/remotes/origin/main");
const originMainPackedRefs = resolve(commonGitDir, "packed-refs");
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
