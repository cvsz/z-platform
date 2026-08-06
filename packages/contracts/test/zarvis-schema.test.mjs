import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaPaths = [
  new URL('../schemas/zarvis.command.requested.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.command.completed.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.audit.tool-executed.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.session.event.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.task.requested.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.task.approval.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.task.snapshot.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.memory.proposal.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.memory.snapshot.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.memory.export.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.action.preview.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.action.approval.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.action.result.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.action.rollback.v1.schema.json', import.meta.url),
];

test('ZARVIS schemas are valid JSON Schema documents with unique identifiers', async () => {
  const ids = new Set();
  for (const path of schemaPaths) {
    const schema = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.match(schema.$id, /^https:\/\/schemas\.zeaz\.dev\/zarvis\//);
    assert.equal(ids.has(schema.$id), false);
    ids.add(schema.$id);
    assert.equal(schema.additionalProperties, false);
  }
});

test('command schema admits only the read-only GitHub status tool', async () => {
  const schema = JSON.parse(await readFile(schemaPaths[0], 'utf8'));
  assert.equal(schema.properties.tool.properties.name.const, 'github.repository.status');
});

test('command completion schema supports explicit idempotent replay metadata', async () => {
  const schema = JSON.parse(await readFile(schemaPaths[1], 'utf8'));
  assert.equal(schema.properties.replayed.type, 'boolean');
});

test('session event schema is append-only and uses a closed event type set', async () => {
  const schema = JSON.parse(await readFile(schemaPaths[3], 'utf8'));
  assert.deepEqual(schema.properties.event_type.enum, [
    'command.accepted',
    'command.completed',
    'command.failed',
  ]);
  assert.equal(schema.properties.actor.additionalProperties, false);
});

test('task request schema admits only registered read-only task tools', async () => {
  const schema = JSON.parse(await readFile(schemaPaths[4], 'utf8'));
  assert.deepEqual(schema.properties.steps.items.properties.tool.enum, [
    'github.repository.status',
    'zarvis.repository.summary',
  ]);
  assert.equal(schema.properties.steps.items.properties.mutating.const, false);
});

test('task approval schema requires a SHA-256 digest and one-time nonce', async () => {
  const schema = JSON.parse(await readFile(schemaPaths[5], 'utf8'));
  assert.deepEqual(schema.required, ['schema_version', 'approval_digest', 'approval_nonce']);
  assert.equal(schema.properties.approval_digest.pattern, '^[a-f0-9]{64}$');
});

test('task snapshot schema is permanently owner-bound', async () => {
  const schema = JSON.parse(await readFile(schemaPaths[6], 'utf8'));
  assert.equal(schema.properties.tenant_id.const, 'owner-4076926');
  assert.equal(schema.properties.owner_user_id.const, 'github:4076926');
});

test('memory proposal schema requires provenance and exact approval proof', async () => {
  const schema = JSON.parse(await readFile(schemaPaths[7], 'utf8'));
  assert.ok(schema.required.includes('provenance'));
  assert.equal(schema.properties.approval_digest.pattern, '^[a-f0-9]{64}$');
  assert.equal(schema.$defs.provenance.additionalProperties, false);
});

test('memory snapshot and export schemas are permanently owner-bound', async () => {
  const snapshot = JSON.parse(await readFile(schemaPaths[8], 'utf8'));
  const exported = JSON.parse(await readFile(schemaPaths[9], 'utf8'));
  assert.equal(snapshot.properties.owner_user_id.const, 'github:4076926');
  assert.equal(snapshot.properties.tenant_id.const, 'owner-4076926');
  assert.equal(exported.properties.owner_user_id.const, 'github:4076926');
  assert.equal(exported.properties.tenant_id.const, 'owner-4076926');
});

test('local action preview is owner-bound, reversible, and allowlisted', async () => {
  const preview = JSON.parse(await readFile(schemaPaths[10], 'utf8'));
  assert.equal(preview.properties.capability.const, 'sandbox.preference.set');
  assert.equal(preview.properties.owner_user_id.const, 'github:4076926');
  assert.equal(preview.properties.tenant_id.const, 'owner-4076926');
  assert.equal(preview.properties.status.const, 'pending_approval');
});

test('local action approval and rollback require SHA-256 proof plus nonce', async () => {
  for (const index of [11, 13]) {
    const schema = JSON.parse(await readFile(schemaPaths[index], 'utf8'));
    const digestProperty = index === 11 ? 'approval_digest' : 'rollback_digest';
    assert.equal(schema.properties[digestProperty].pattern, '^[a-f0-9]{64}$');
  }
});

test('local action result exposes rollback proof and immutable owner identity', async () => {
  const result = JSON.parse(await readFile(schemaPaths[12], 'utf8'));
  assert.equal(result.properties.status.const, 'executed');
  assert.equal(result.properties.owner_user_id.const, 'github:4076926');
  assert.ok(result.required.includes('rollback_digest'));
  assert.ok(result.required.includes('rollback_nonce'));
});
