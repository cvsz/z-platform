import { appendFileSync } from "node:fs";

export const REQUIRED_CHECKS = Object.freeze([
  "Node workspace",
  "dependency-and-provenance",
  "Analyze (javascript-typescript)",
  "Analyze (python)",
  "Analyze (go)",
  "Analyze (actions)",
  "secret-patterns",
  "node",
  "python",
  "compose",
  "deployed-smoke",
  "sbom",
]);

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const GITHUB_API = "https://api.github.com";

export function validateAdmissionContext({
  eventName,
  ref,
  sha,
  approvedSha,
  mainSha,
  commitVerified,
}) {
  const errors = [];

  if (!SHA_PATTERN.test(sha ?? "")) {
    errors.push("event SHA must be a full lowercase 40-character commit SHA");
  }
  if (ref !== "refs/heads/main") {
    errors.push("image publication is allowed only from refs/heads/main");
  }
  if (mainSha !== sha) {
    errors.push("event SHA is not the current main branch HEAD");
  }
  if (commitVerified !== true) {
    errors.push("source commit does not have GitHub-verified signature provenance");
  }
  if (eventName === "workflow_dispatch" && approvedSha !== sha) {
    errors.push("manual dispatch must explicitly approve the exact event SHA");
  } else if (eventName !== "push" && eventName !== "workflow_dispatch") {
    errors.push("unsupported image publication event");
  }

  return { ok: errors.length === 0, errors };
}

export function evaluateRequiredChecks(checkRuns, expectedSha) {
  if (!Array.isArray(checkRuns)) {
    return { state: "failed", results: [], errors: ["check-runs payload is invalid"] };
  }

  const results = REQUIRED_CHECKS.map((name) => {
    const candidates = checkRuns
      .filter((run) =>
        run?.name === name &&
        run?.head_sha === expectedSha &&
        run?.app?.slug === "github-actions"
      )
      .sort((left, right) =>
        String(right.started_at ?? right.created_at ?? "").localeCompare(
          String(left.started_at ?? left.created_at ?? "")
        )
      );

    if (candidates.length === 0) {
      return { name, state: "missing", conclusion: null };
    }

    const latest = candidates[0];
    if (latest.status !== "completed") {
      return { name, state: "pending", conclusion: latest.conclusion ?? null };
    }
    if (latest.conclusion !== "success") {
      return { name, state: "failed", conclusion: latest.conclusion ?? null };
    }
    return { name, state: "success", conclusion: "success" };
  });

  if (results.some((item) => item.state === "failed")) {
    return { state: "failed", results };
  }
  if (results.some((item) => item.state !== "success")) {
    return { state: "pending", results };
  }
  return { state: "success", results };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function appendSummary(markdown) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path) appendFileSync(path, markdown);
}

async function githubGet(path, token) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed with HTTP ${response.status}: ${path}`);
  }
  return response.json();
}

async function verifyCurrentMain({ repository, sha, eventName, ref, approvedSha, token }) {
  const [branch, commit] = await Promise.all([
    githubGet(`/repos/${repository}/branches/main`, token),
    githubGet(`/repos/${repository}/commits/${sha}`, token),
  ]);
  const result = validateAdmissionContext({
    eventName,
    ref,
    sha,
    approvedSha,
    mainSha: branch?.commit?.sha,
    commitVerified: commit?.commit?.verification?.verified === true,
  });
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
}

function summaryFor(sha, evaluation, result) {
  const lines = [
    "## GHCR exact-SHA admission",
    "",
    `- Commit: \`${sha}\``,
    `- Decision: **${result}**`,
    "",
    "| Required check | Result |",
    "|---|---|",
    ...evaluation.results.map((item) =>
      `| ${item.name} | ${item.state}${item.conclusion ? ` (${item.conclusion})` : ""} |`
    ),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const sha = process.env.GITHUB_SHA ?? "";
  const ref = process.env.GITHUB_REF ?? "";
  const eventName = process.env.GITHUB_EVENT_NAME ?? "";
  const approvedSha = process.env.APPROVED_SHA ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";
  const maxWaitSeconds = Number(process.env.ADMISSION_MAX_WAIT_SECONDS ?? "1200");
  const pollIntervalSeconds = Number(process.env.ADMISSION_POLL_INTERVAL_SECONDS ?? "20");

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY is invalid");
  }
  if (!token) throw new Error("GITHUB_TOKEN is required for read-only admission checks");
  if (!Number.isSafeInteger(maxWaitSeconds) || maxWaitSeconds < 0) {
    throw new Error("ADMISSION_MAX_WAIT_SECONDS must be a non-negative integer");
  }
  if (!Number.isSafeInteger(pollIntervalSeconds) || pollIntervalSeconds < 1) {
    throw new Error("ADMISSION_POLL_INTERVAL_SECONDS must be a positive integer");
  }

  await verifyCurrentMain({ repository, sha, eventName, ref, approvedSha, token });

  const startedAt = Date.now();
  let evaluation;
  while (true) {
    const payload = await githubGet(
      `/repos/${repository}/commits/${sha}/check-runs?per_page=100`,
      token,
    );
    if (
      !Number.isSafeInteger(payload?.total_count) ||
      !Array.isArray(payload?.check_runs) ||
      payload.total_count !== payload.check_runs.length
    ) {
      throw new Error("check-runs response is incomplete; refusing image publication");
    }

    evaluation = evaluateRequiredChecks(payload.check_runs, sha);
    if (evaluation.state === "success") break;
    if (evaluation.state === "failed") {
      appendSummary(summaryFor(sha, evaluation, "BLOCKED"));
      throw new Error(
        `required exact-SHA checks failed: ${evaluation.results
          .filter((item) => item.state === "failed")
          .map((item) => `${item.name}=${item.conclusion}`)
          .join(", ")}`,
      );
    }

    if (maxWaitSeconds === 0 || Date.now() - startedAt >= maxWaitSeconds * 1000) {
      appendSummary(summaryFor(sha, evaluation, "BLOCKED"));
      throw new Error(
        `required exact-SHA checks are missing or pending: ${evaluation.results
          .filter((item) => item.state !== "success")
          .map((item) => item.name)
          .join(", ")}`,
      );
    }
    await delay(pollIntervalSeconds * 1000);
  }

  // Re-check branch identity and signature immediately before admission succeeds.
  await verifyCurrentMain({ repository, sha, eventName, ref, approvedSha, token });
  appendSummary(summaryFor(sha, evaluation, "ADMITTED FOR GHCR PUBLICATION"));
  console.log(`GHCR admission passed for exact Main SHA ${sha}`);
}

const isDirectExecution =
  process.argv[1] &&
  new URL(import.meta.url).href === new URL(`file://${process.argv[1]}`).href;

if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "admission failed";
    console.error(`GHCR admission blocked: ${message}`);
    appendSummary(`## GHCR exact-SHA admission\n\n- Decision: **BLOCKED**\n- Reason: ${message}\n`);
    process.exitCode = 1;
  });
}
