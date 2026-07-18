import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const envScope = join(root, "scripts/cloudflare/lib/env-scope.sh");
const rotation = join(root, "scripts/cloudflare/rotate-tokens-with-permission-preflight.sh");

function loadScopedValue({ shellValue, baseValue, generatedValue }) {
  const fixture = mkdtempSync(join(tmpdir(), "z-platform-cf-env-"));
  const baseFile = join(fixture, "base.env");
  const generatedFile = join(fixture, "generated.env");
  writeFileSync(baseFile, `CLOUDFLARE_ACCOUNT_ID=${baseValue ?? ""}\n`, { mode: 0o600 });
  writeFileSync(generatedFile, `CLOUDFLARE_ACCOUNT_ID=${generatedValue ?? ""}\n`, { mode: 0o600 });

  const environment = {
    ...process.env,
    PROJECT_ROOT: root,
    CLOUDFLARE_ENV_FILE: baseFile,
    CLOUDFLARE_TOKEN_ENV_FILE: generatedFile,
  };
  if (shellValue === undefined) {
    delete environment.CLOUDFLARE_ACCOUNT_ID;
  } else {
    environment.CLOUDFLARE_ACCOUNT_ID = shellValue;
  }

  return execFileSync(
    "bash",
    ["-c", 'source "$1"; cf_load_cloudflare_env_scope; printf "%s" "${CLOUDFLARE_ACCOUNT_ID-<unset>}"', "bash", envScope],
    { cwd: root, env: environment, encoding: "utf8" },
  );
}

test("Cloudflare env scope preserves explicit non-empty shell identity", () => {
  assert.equal(
    loadScopedValue({ shellValue: "shell-account", baseValue: "base-account", generatedValue: "generated-account" }),
    "shell-account",
  );
});

test("Cloudflare env scope prefers base identity over generated identity", () => {
  assert.equal(
    loadScopedValue({ baseValue: "base-account", generatedValue: "generated-account" }),
    "base-account",
  );
});

test("Cloudflare env scope falls back from blank base identity to generated identity", () => {
  assert.equal(
    loadScopedValue({ baseValue: "", generatedValue: "generated-account" }),
    "generated-account",
  );
});

test("offline token rotation previews scoped tokens without writing output", () => {
  const fixture = mkdtempSync(join(tmpdir(), "z-platform-cf-rotation-"));
  const outputFile = join(fixture, "tokens.env");
  const result = spawnSync(
    "bash",
    [
      rotation,
      "--offline",
      "--regenerate",
      "--types",
      "dns,zt,workers,pages,tunnel",
      "--perm-id",
      "test-permission-group",
      "--write",
      outputFile,
      "--dry-run",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        CLOUDFLARE_ENV_FILE: "/dev/null",
        CLOUDFLARE_TOKEN_ENV_FILE: "/dev/null",
        CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
        CLOUDFLARE_ZONE_ID: "11111111111111111111111111111111",
        CACHE_DIR: join(fixture, "cache"),
        BACKUP_DIR: join(fixture, "backups"),
        AUDIT_LOG: join(fixture, "audit.log"),
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY-RUN: would create zeaz-dns-token/);
  assert.match(result.stdout, /CLOUDFLARE_DNS_TOKEN=""/);
  assert.throws(() => readFileSync(outputFile), /ENOENT/);
});

test("live Make targets require explicit operator confirmation", () => {
  const makefile = readFileSync(join(root, "Makefile"), "utf8");
  assert.match(makefile, /TOKEN_ROTATE_CONFIRM\)" = "YES"/);
  assert.match(makefile, /TOKEN_CLEAN_CONFIRM\)" = "YES"/);
  assert.match(makefile, /TOKEN_ROTATE_TYPES \?= dns,zt,workers,pages,tunnel/);
});
