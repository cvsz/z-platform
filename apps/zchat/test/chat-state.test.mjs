import assert from "node:assert/strict";
import test from "node:test";

import {
  STORAGE_KEYS,
  appendMessage,
  clearChatState,
  createChatState,
  lastUserMessage,
  loadChatState,
  persistChatState,
  replaceMessage,
} from "../public/chat-state.mjs";

function createStorage(entries = {}) {
  const store = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    snapshot() {
      return Object.fromEntries(store.entries());
    },
  };
}

test("createChatState seeds a fresh conversation boundary", () => {
  const state = createChatState(1700000000000, () => "conversation-1");

  assert.deepEqual(state, {
    conversationId: "conversation-1",
    sessionStartedAt: "1700000000000",
    model: "",
    messages: [],
  });
});

test("loadChatState hydrates persisted conversation and messages", () => {
  const storage = createStorage({
    [STORAGE_KEYS.conversationId]: "conversation-1",
    [STORAGE_KEYS.sessionStartedAt]: "1700000000000",
    [STORAGE_KEYS.model]: "hf:test",
    [STORAGE_KEYS.messages]: JSON.stringify([{ id: "1", role: "user", content: "hello" }]),
  });

  const state = loadChatState(storage, 1700000001000, () => "ignored");
  assert.equal(state.conversationId, "conversation-1");
  assert.equal(state.sessionStartedAt, "1700000000000");
  assert.equal(state.model, "hf:test");
  assert.equal(state.messages.length, 1);
});

test("persistChatState and clearChatState keep browser storage isolated", () => {
  const storage = createStorage();
  const state = createChatState(1700000000000, () => "conversation-1");

  persistChatState(storage, {
    ...state,
    model: "hf:test",
    messages: [{ id: "1", role: "assistant", content: "ok" }],
  });

  assert.equal(storage.getItem(STORAGE_KEYS.model), "hf:test");
  assert.ok(storage.getItem(STORAGE_KEYS.messages).includes("assistant"));

  const cleared = clearChatState(storage, 1700000000100, () => "conversation-2");
  assert.equal(cleared.conversationId, "conversation-2");
  assert.equal(storage.getItem(STORAGE_KEYS.messages), "[]");
});

test("message helpers preserve ordering and recover the last user message", () => {
  const seeded = appendMessage(
    appendMessage(createChatState(1700000000000, () => "conversation-1"), { id: "1", role: "user", content: "hello" }),
    { id: "2", role: "assistant", content: "hi" },
  );
  const updated = replaceMessage(seeded, "2", { content: "hello there" });

  assert.equal(lastUserMessage(updated.messages).content, "hello");
  assert.equal(updated.messages[1].content, "hello there");
});
