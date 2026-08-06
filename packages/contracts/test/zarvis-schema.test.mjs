import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaPaths = [
  new URL('../schemas/zarvis.command.requested.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.command.completed.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.audit.tool-executed.v1.schema.json', import.meta.url),
  new URL('../schemas/zarvis.session.event.v1.schema.json', import.meta.url),
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
