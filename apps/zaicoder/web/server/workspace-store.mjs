import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const DEFAULT_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 365;
const WORKSPACE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export class WorkspaceStoreError extends Error {}

function normalizeRetentionDays(value) {
  const days = Number(value ?? DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > MAX_RETENTION_DAYS) {
    throw new WorkspaceStoreError("retention_days must be an integer between 1 and 365");
  }
  return days;
}

function normalizeWorkspaceId(value, idGenerator) {
  const id = typeof value === "string" && value.trim() ? value.trim() : idGenerator();
  if (!WORKSPACE_ID.test(id)) throw new WorkspaceStoreError("workspace_id is invalid");
  return id;
}

function normalizeOwner(value) {
  const owner = typeof value === "string" && value.trim() ? value.trim() : "local";
  if (owner.length > 128) throw new WorkspaceStoreError("workspace owner is too long");
  return owner;
}

function expiresAt(now, retentionDays) {
  return new Date(new Date(now).getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

export class WorkspaceStore {
  constructor({ root = process.env.ZAICODER_WORKSPACE_STORE || ".zaicoder-workspaces", idGenerator = randomUUID, now = () => new Date().toISOString() } = {}) {
    this.root = root;
    this.idGenerator = idGenerator;
    this.now = now;
  }

  pathFor(id) {
    return join(this.root, `${id}.json`);
  }

  async read(id) {
    if (!WORKSPACE_ID.test(id)) throw new WorkspaceStoreError("workspace_id is invalid");
    try {
      return JSON.parse(await readFile(this.pathFor(id), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async save(record) {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.pathFor(record.id), JSON.stringify(record, null, 2) + "\n", "utf8");
    return record;
  }

  async ensure(input = {}) {
    const now = this.now();
    const id = normalizeWorkspaceId(input.workspace_id, this.idGenerator);
    const existing = await this.read(id);
    if (existing) {
      const retentionDays = normalizeRetentionDays(input.retention_days ?? existing.retention_days);
      return this.save({
        ...existing,
        owner: normalizeOwner(input.owner ?? existing.owner),
        retention_days: retentionDays,
        expires_at: expiresAt(now, retentionDays),
        updated_at: now,
      });
    }

    const retentionDays = normalizeRetentionDays(input.retention_days);
    return this.save({
      id,
      owner: normalizeOwner(input.owner),
      retention_days: retentionDays,
      created_at: now,
      updated_at: now,
      expires_at: expiresAt(now, retentionDays),
      files: [],
    });
  }

  async addFile(workspaceId, file) {
    const workspace = await this.ensure({ workspace_id: workspaceId });
    const now = this.now();
    const next = {
      ...workspace,
      files: [...workspace.files.filter((item) => item.id !== file.id), { id: file.id, name: file.name, size_bytes: file.size_bytes, added_at: now }],
      updated_at: now,
    };
    return this.save(next);
  }
}
