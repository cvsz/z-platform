import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRequiredChecks,
  REQUIRED_CHECKS,
  validateAdmissionContext,
} from "../verify-container-image-admission.mjs";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function successfulRuns() {
  return REQUIRED_CHECKS.map((name, index) => ({
    name,
    head_sha: SHA,
    app: { slug: "github-actions" },
    status: "completed",
    conclusion: "success",
    started_at: `2026-11-07T00:${String(index).padStart(2, "0")}:00Z`,
  }));
}

test("all required checks on the exact SHA admit publication", () => {
  const result = evaluateRequiredChecks(successfulRuns(), SHA);
  assert.equal(result.state, "success");
  assert.equal(result.results.length, REQUIRED_CHECKS.length);
});

test("a missing required check remains pending and cannot admit", () => {
  const runs = successfulRuns().filter((run) => run.name !== "secret-patterns");
  const result = evaluateRequiredChecks(runs, SHA);
  assert.equal(result.state, "pending");
  assert.equal(result.results.find((item) => item.name === "secret-patterns").state, "missing");
});

test("a failed required check blocks publication", () => {
  const runs = successfulRuns();
  runs.find((run) => run.name === "node").conclusion = "failure";
  const result = evaluateRequiredChecks(runs, SHA);
  assert.equal(result.state, "failed");
});

test("the newest pending run supersedes an older successful run", () => {
  const runs = successfulRuns();
  const prior = { ...runs[0], started_at: "2026-11-06T00:00:00Z" };
  const pending = { ...runs[0], status: "in_progress", conclusion: null, started_at: "2026-11-07T23:00:00Z" };
  const result = evaluateRequiredChecks([...runs, prior, pending], SHA);
  assert.equal(result.state, "pending");
  assert.equal(result.results.find((item) => item.name === REQUIRED_CHECKS[0]).state, "pending");
});

test("third-party and stale-SHA check runs cannot satisfy required checks", () => {
  const runs = successfulRuns().map((run) => ({ ...run }));
  runs[0].app = { slug: "untrusted-app" };
  runs[1].head_sha = OTHER_SHA;
  const result = evaluateRequiredChecks(runs, SHA);
  assert.equal(result.state, "pending");
  assert.equal(result.results[0].state, "missing");
  assert.equal(result.results[1].state, "missing");
});

test("push admission requires the exact current signed Main commit", () => {
  const result = validateAdmissionContext({
    eventName: "push",
    ref: "refs/heads/main",
    sha: SHA,
    approvedSha: "",
    mainSha: SHA,
    commitVerified: true,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("manual dispatch requires an explicit approval of the exact SHA", () => {
  const accepted = validateAdmissionContext({
    eventName: "workflow_dispatch",
    ref: "refs/heads/main",
    sha: SHA,
    approvedSha: SHA,
    mainSha: SHA,
    commitVerified: true,
  });
  const rejected = validateAdmissionContext({
    eventName: "workflow_dispatch",
    ref: "refs/heads/main",
    sha: SHA,
    approvedSha: OTHER_SHA,
    mainSha: SHA,
    commitVerified: true,
  });
  assert.equal(accepted.ok, true);
  assert.equal(rejected.ok, false);
  assert.match(rejected.errors.join(" "), /exact event SHA/);
});

test("stale Main, non-main refs, and unverified signatures fail closed", () => {
  for (const overrides of [
    { mainSha: OTHER_SHA },
    { ref: "refs/heads/feature" },
    { commitVerified: false },
  ]) {
    const result = validateAdmissionContext({
      eventName: "push",
      ref: "refs/heads/main",
      sha: SHA,
      approvedSha: "",
      mainSha: SHA,
      commitVerified: true,
      ...overrides,
    });
    assert.equal(result.ok, false);
  }
});
