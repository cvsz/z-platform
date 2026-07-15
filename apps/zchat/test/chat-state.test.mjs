import assert from "node:assert/strict";
import test from "node:test";

import {
  STORAGE_KEYS,
  activeConversationSummary,
  appendMessage,
  clearActiveConversation,
  clearChatState,
  conversationSummaries,
  createChatState,
  lastUserMessage,
  loadChatState,
  persistChatState,
  renameActiveConversation,
  selectConversation,
  startNewConversation,
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

test("createChatState seeds one conversation with matching active id", () => {
  const state = createChatState(1700000000000, () => "conversation-1");

  assert.equal(state.activeConversationId, "conversation-1");
  assert.equal(state.conversationId, "conversation-1");
  assert.equal(state.sessionStartedAt, "1700000000000");
  assert.equal(state.conversations.length, 1);
  assert.equal(state.conversations[0].id, "conversation-1");
});

test("loadChatState hydrates persisted conversation history and selection", () => {
  const storage = createStorage({
    [STORAGE_KEYS.activeConversationId]: "conversation-2",
    [STORAGE_KEYS.sessionStartedAt]: "1700000000000",
    [STORAGE_KEYS.conversations]: JSON.stringify([
      {
        id: "conversation-1",
        title: "First chat",
        model: "hf:first",
        messages: [{ id: "1", role: "user", content: "hello" }],
        createdAt: 1700000000000,
        updatedAt: 1700000000100,
      },
      {
        id: "conversation-2",
        title: "Second chat",
        model: "hf:second",
        messages: [{ id: "2", role: "assistant", content: "hi" }],
        createdAt: 1700000000200,
        updatedAt: 1700000000300,
      },
    ]),
  });

  const state = loadChatState(storage, 1700000001000, () => "ignored");
  assert.equal(state.activeConversationId, "conversation-2");
  assert.equal(state.messages.length, 1);
  assert.equal(state.model, "hf:second");
  assert.equal(activeConversationSummary(state).title, "Second chat");
  assert.equal(conversationSummaries(state)[0].id, "conversation-2");
});

test("legacy storage hydrates into the active conversation", () => {
  const storage = createStorage({
    [STORAGE_KEYS.conversationId]: "conversation-1",
    [STORAGE_KEYS.sessionStartedAt]: "1700000000000",
    [STORAGE_KEYS.model]: "hf:test",
    [STORAGE_KEYS.messages]: JSON.stringify([{ id: "1", role: "user", content: "hello" }]),
  });

  const state = loadChatState(storage, 1700000001000, () => "ignored");
  assert.equal(state.activeConversationId, "conversation-1");
  assert.equal(state.conversations.length, 1);
  assert.equal(state.messages.length, 1);
  assert.equal(state.model, "hf:test");
});

test("persistChatState writes active conversation and history records", () => {
  const storage = createStorage();
  const state = appendMessage(
    appendMessage(createChatState(1700000000000, () => "conversation-1"), { id: "1", role: "user", content: "hello" }, 1700000000100),
    { id: "2", role: "assistant", content: "hi" },
    1700000000200,
  );

  persistChatState(storage, {
    ...state,
    model: "hf:test",
  });

  const snapshot = storage.snapshot();
  assert.equal(snapshot[STORAGE_KEYS.activeConversationId], "conversation-1");
  assert.equal(snapshot[STORAGE_KEYS.model], "hf:test");
  assert.ok(snapshot[STORAGE_KEYS.messages].includes("assistant"));
  assert.ok(snapshot[STORAGE_KEYS.conversations].includes("conversation-1"));
});

test("history helpers preserve selection and support new chat and clearing", () => {
  const seeded = appendMessage(
    appendMessage(createChatState(1700000000000, () => "conversation-1"), { id: "1", role: "user", content: "hello there" }, 1700000000100),
    { id: "2", role: "assistant", content: "hi" },
    1700000000200,
  );

  const rotated = startNewConversation(seeded, 1700000000500, () => "conversation-2");
  assert.equal(rotated.activeConversationId, "conversation-2");
  assert.equal(conversationSummaries(rotated)[0].id, "conversation-2");
  assert.equal(conversationSummaries(rotated)[1].title, "hello there");

  const restored = selectConversation(rotated, "conversation-1");
  assert.equal(restored.activeConversationId, "conversation-1");
  assert.equal(lastUserMessage(restored.messages).content, "hello there");

  const cleared = clearActiveConversation(restored, 1700000000600, () => "conversation-3");
  assert.equal(cleared.activeConversationId, "conversation-1");
  assert.equal(cleared.messages.length, 0);
  assert.equal(activeConversationSummary(cleared).title, "New chat");
});

test("renameActiveConversation rebases the active conversation id", () => {
  const seeded = appendMessage(
    appendMessage(createChatState(1700000000000, () => "conversation-1"), { id: "1", role: "user", content: "hello" }, 1700000000100),
    { id: "2", role: "assistant", content: "hi" },
    1700000000200,
  );

  const renamed = renameActiveConversation(seeded, "conversation-9");
  assert.equal(renamed.activeConversationId, "conversation-9");
  assert.equal(renamed.conversations[0].id, "conversation-9");
  assert.equal(renamed.messages.length, 2);
});

test("clearChatState resets browser storage to a fresh chat", () => {
  const storage = createStorage();
  const cleared = clearChatState(storage, 1700000000100, () => "conversation-2");

  assert.equal(cleared.activeConversationId, "conversation-2");
  assert.equal(storage.getItem(STORAGE_KEYS.messages), "[]");
  assert.ok(storage.getItem(STORAGE_KEYS.conversations).includes("conversation-2"));
});
