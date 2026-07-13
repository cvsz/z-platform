import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WorkspaceStore, WorkspaceStoreError } from "../server/workspace-store.mjs";

test("creates workspace metadata with retention", async () => {
  const root = await mkdtemp(join(tmpdir(), "zaicoder-workspaces-"));
  try {
    const store = new WorkspaceStore({ root, idGenerator: () => "workspace-1", now: () => "2026-07-13T00:00:00.000Z" });
    const workspace = await store.ensure({ owner: "tenant-1", retention_days: 7 });

    assert.equal(workspace.id, "workspace-1");
    assert.equal(workspace.owner, "tenant-1");
    assert.equal(workspace.retention_days, 7);
    assert.equal(workspace.expires_at, "2026-07-20T00:00:00.000Z");
    assert.deepEqual(workspace.files, []);
    assert.deepEqual(await store.read("workspace-1"), workspace);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("adds uploaded files to workspace metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "zaicoder-workspaces-"));
  try {
    const store = new WorkspaceStore({ root, now: () => "2026-07-13T00:00:00.000Z" });
    const workspace = await store.addFile("workspace-1", { id: "file-1", name: "notes.txt", size_bytes: 3 });

    assert.equal(workspace.id, "workspace-1");
    assert.deepEqual(workspace.files, [{ id: "file-1", name: "notes.txt", size_bytes: 3, added_at: "2026-07-13T00:00:00.000Z" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unsafe workspace ids and retention", async () => {
  const root = await mkdtemp(join(tmpdir(), "zaicoder-workspaces-"));
  try {
    const store = new WorkspaceStore({ root });
    await assert.rejects(store.ensure({ workspace_id: "../bad" }), WorkspaceStoreError);
    await assert.rejects(store.ensure({ retention_days: 366 }), WorkspaceStoreError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
