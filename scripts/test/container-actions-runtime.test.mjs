import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(".github/workflows/container-images.yml", "utf8");

test("container publication pins Node 24 action majors by immutable SHA", () => {
  const expected = [
    ["actions/checkout", "v5"],
    ["docker/setup-buildx-action", "v4"],
    ["docker/login-action", "v4"],
    ["docker/metadata-action", "v6"],
    ["docker/build-push-action", "v7"],
  ];
  for (const [action, major] of expected) {
    const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(workflow, new RegExp(`uses: ${escapedAction}@[0-9a-f]{40} # ${major}`));
  }
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d+/);
});
