import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateStagingDecisionRecord } from "../validate-staging-decision-record.mjs";

const record = JSON.parse(await readFile(new URL("../../scripts/staging-decision-record.json", import.meta.url), "utf8"));

test("accepts the current staging decision record", () => {
  assert.deepEqual(validateStagingDecisionRecord(record), []);
});

test("rejects placeholder identity mapping values", () => {
  const value = structuredClone(record);
  value.identityProvider.claimMappingReference = "pending:identity-claims";
  assert.match(validateStagingDecisionRecord(value).join("\n"), /identityProvider\.claimMappingReference/);
});

test("rejects unapproved identity provider records", () => {
  const value = structuredClone(record);
  value.identityProvider.status = "pending";
  assert.match(validateStagingDecisionRecord(value).join("\n"), /identityProvider\.status must be approved/);
});

test("rejects a provided non-SHA releaseSha", () => {
  const value = structuredClone(record);
  value.releaseSha = "main";
  assert.match(validateStagingDecisionRecord(value).join("\n"), /releaseSha must be a 40-character lowercase commit SHA/);
});
