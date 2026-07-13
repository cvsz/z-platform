import assert from "node:assert/strict";
import test from "node:test";

import {
  AttachmentAdapterError,
  translateAnthropicMessagesPayload,
  translateAttachmentBuffer,
  translateAttachmentPayload,
  translateOpenAiCompatiblePayload,
  validateAttachmentReferences,
} from "../attachments.mjs";

test("validates and normalizes platform attachment references", () => {
  assert.deepEqual(validateAttachmentReferences([{ id: " file-1 ", name: " notes.txt ", mime_type: " text/plain ", size_bytes: 5 }]), [
    { id: "file-1", name: "notes.txt", mime_type: "text/plain", size_bytes: 5 },
  ]);
});

test("rejects invalid attachment contracts", () => {
  assert.throws(() => validateAttachmentReferences({ id: "file-1" }), AttachmentAdapterError);
  assert.throws(() => validateAttachmentReferences([{ id: "file-1" }]), /attachments require id and name/);
  assert.throws(() => validateAttachmentReferences(Array.from({ length: 21 }, (_, index) => ({ id: `file-${index}`, name: "x" }))), /too many attachments/);
});

test("translates OpenAI-compatible attachments into metadata and user context", () => {
  const translated = translateOpenAiCompatiblePayload({
    model: "default",
    messages: [{ role: "user", content: "summarize" }],
  }, [{ id: "file-1", name: "notes.txt", mime_type: "text/plain" }]);

  assert.equal(translated.attachments, undefined);
  assert.deepEqual(translated.metadata.z_platform.attachments, [{ id: "file-1", name: "notes.txt", mime_type: "text/plain" }]);
  assert.match(translated.messages[0].content, /Attached platform files:/);
  assert.match(translated.messages[0].content, /notes\.txt \(file-1\); text\/plain/);
});

test("translates Anthropic messages into content blocks", () => {
  const translated = translateAnthropicMessagesPayload({
    model: "claude",
    messages: [{ role: "user", content: [{ type: "text", text: "summarize" }] }],
  }, [{ id: "file-1", name: "notes.txt" }]);

  assert.equal(translated.attachments, undefined);
  assert.deepEqual(translated.metadata.z_platform.attachments, [{ id: "file-1", name: "notes.txt" }]);
  assert.deepEqual(translated.messages[0].content[1], { type: "text", text: "Attached platform files:\n- notes.txt (file-1)" });
});

test("dispatches adapter by provider", () => {
  const translated = translateAttachmentPayload({
    messages: [{ role: "user", content: "hello" }],
    attachments: [{ id: "file-1", name: "notes.txt" }],
  }, { provider: "anthropic" });

  assert.equal(translated.messages[0].content[1].text, "Attached platform files:\n- notes.txt (file-1)");
});

test("rejects unsupported providers", () => {
  assert.throws(() => translateAttachmentPayload({ attachments: [{ id: "file-1", name: "notes.txt" }] }, { provider: "unknown" }), /unsupported attachment provider/);
});

test("translates JSON buffers and preserves non-JSON buffers", () => {
  const original = Buffer.from(JSON.stringify({ messages: [], attachments: [{ id: "file-1", name: "notes.txt" }] }));
  const translated = JSON.parse(translateAttachmentBuffer(original, "application/json", { provider: "openai-compatible" }).toString("utf8"));

  assert.equal(translated.attachments, undefined);
  assert.deepEqual(translated.metadata.z_platform.attachments, [{ id: "file-1", name: "notes.txt" }]);
  assert.equal(translateAttachmentBuffer(Buffer.from("raw"), "text/plain").toString("utf8"), "raw");
});
