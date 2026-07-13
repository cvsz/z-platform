import assert from "node:assert/strict";
import test from "node:test";

import {
  UploadAdapterError,
  normalizeUploadFilename,
  translateOpenAiCompatibleUpload,
  translateUploadRequest,
  uploadProviderSupportsBinary,
} from "../uploads.mjs";

test("normalizes safe upload filenames", () => {
  assert.equal(normalizeUploadFilename(" notes.txt "), "notes.txt");
  assert.equal(normalizeUploadFilename(undefined), undefined);
  assert.equal(normalizeUploadFilename(""), undefined);
});

test("rejects unsafe upload filenames", () => {
  assert.throws(() => normalizeUploadFilename("bad\nname.txt"), UploadAdapterError);
  assert.throws(() => normalizeUploadFilename("x".repeat(257)), /too long/);
});

test("translates OpenAI-compatible binary uploads", () => {
  const body = Buffer.from("hello");
  const translated = translateOpenAiCompatibleUpload(body, {
    contentType: "text/plain",
    filename: "notes.txt",
  });

  assert.equal(translated.path, "/v1/files");
  assert.equal(translated.body, body);
  assert.deepEqual(translated.headers, {
    "Content-Type": "text/plain",
    "X-Filename": "notes.txt",
  });
});

test("rejects empty upload bodies before upstream forwarding", () => {
  assert.throws(() => translateUploadRequest(Buffer.alloc(0), { provider: "openai-compatible" }), /upload body is empty/);
});

test("tracks provider binary upload support", () => {
  assert.equal(uploadProviderSupportsBinary("openai-compatible"), true);
  assert.equal(uploadProviderSupportsBinary("openai"), true);
  assert.equal(uploadProviderSupportsBinary("anthropic"), false);
});

test("returns structured unsupported provider errors", () => {
  assert.throws(() => translateUploadRequest(Buffer.from("hello"), { provider: "anthropic" }), /not enabled/);
  assert.throws(() => translateUploadRequest(Buffer.from("hello"), { provider: "unknown" }), /unsupported upload provider/);
});
