import assert from "node:assert/strict";
import test from "node:test";

import {
  STORAGE_KEYS,
  addPromptTemplate,
  activeConversationSummary,
  appendMessage,
  clearActiveConversation,
  clearChatState,
  conversationSummaries,
  createChatState,
  createPromptTemplate,
  conversationToExportData,
  conversationToMarkdown,
  lastUserMessage,
  loadChatState,
  loadPromptTemplates,
  persistChatState,
  persistPromptTemplates,
  removePromptTemplate,
  renameActiveConversation,
  selectConversation,
  startNewConversation,
  setActiveSystemPrompt,
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

test("loadPromptTemplates seeds browser-local defaults when storage is empty", () => {
  const storage = createStorage();
  const templates = loadPromptTemplates(storage, 1700000000000, () => "template-default");

  assert.equal(templates.length, 3);
  assert.equal(templates[0].builtIn, true);
  assert.equal(templates[0].id, "summarize");
});

test("prompt template helpers support save, remove, and persistence", () => {
  const storage = createStorage();
  const seeded = [
    createPromptTemplate(1700000000000, () => "template-1", {
      title: "Code review",
      prompt: "Review this file for security issues.",
    }),
  ];

  persistPromptTemplates(storage, seeded);
  const loaded = loadPromptTemplates(storage, 1700000000000, () => "ignored");
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, "Code review");
  assert.equal(loaded[0].preview, "Review this file for security issues.");

  const extended = addPromptTemplate(loaded, {
    id: "template-2",
    title: "Summarize",
    prompt: "Summarize the proposal in bullets.",
  }, 1700000000100, () => "ignored");
  assert.equal(extended.length, 2);
  assert.equal(extended[0].id, "template-2");

  const removed = removePromptTemplate(extended, "template-1");
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, "template-2");
});

test("conversation export helpers produce markdown and JSON-safe data", () => {
  const state = appendMessage(
    appendMessage(
      setActiveSystemPrompt(createChatState(1700000000000, () => "conversation-1"), "Be concise.", 1700000000100),
      { id: "1", role: "user", content: "hello" },
      1700000000200,
    ),
    { id: "2", role: "assistant", content: "hi" },
    1700000000300,
  );

  const markdown = conversationToMarkdown(state);
  assert.ok(markdown.includes("# hello"));
  assert.ok(markdown.includes("## System Prompt"));
  assert.ok(markdown.includes("Be concise."));
  assert.ok(markdown.includes("## Assistant"));

  const data = conversationToExportData(state);
  assert.equal(data.id, "conversation-1");
  assert.equal(data.systemPrompt, "Be concise.");
  assert.equal(data.messages.length, 2);
  assert.equal(data.messages[0].role, "user");
});

test("createChatState seeds one conversation with matching active id", () => {
  const state = createChatState(1700000000000, () => "conversation-1");

  assert.equal(state.activeConversationId, "conversation-1");
  assert.equal(state.conversationId, "conversation-1");
  assert.equal(state.sessionStartedAt, "1700000000000");
  assert.equal(state.systemPrompt, "");
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
        systemPrompt: "Always answer briefly.",
        messages: [{ id: "1", role: "user", content: "hello" }],
        createdAt: 1700000000000,
        updatedAt: 1700000000100,
      },
      {
        id: "conversation-2",
        title: "Second chat",
        model: "hf:second",
        systemPrompt: "Answer as a reviewer.",
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
  assert.equal(state.systemPrompt, "Answer as a reviewer.");
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
  assert.equal(state.systemPrompt, "");
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
    systemPrompt: "Be concise.",
  });

  const snapshot = storage.snapshot();
  assert.equal(snapshot[STORAGE_KEYS.activeConversationId], "conversation-1");
  assert.equal(snapshot[STORAGE_KEYS.model], "hf:test");
  assert.equal(snapshot[STORAGE_KEYS.systemPrompt], "Be concise.");
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
  assert.equal(rotated.systemPrompt, "");

  const restored = selectConversation(rotated, "conversation-1");
  assert.equal(restored.activeConversationId, "conversation-1");
  assert.equal(lastUserMessage(restored.messages).content, "hello there");

  const cleared = clearActiveConversation(restored, 1700000000600, () => "conversation-3");
  assert.equal(cleared.activeConversationId, "conversation-1");
  assert.equal(cleared.messages.length, 0);
  assert.equal(activeConversationSummary(cleared).title, "New chat");
});

test("setActiveSystemPrompt persists with the active conversation", () => {
  const seeded = createChatState(1700000000000, () => "conversation-1");
  const updated = setActiveSystemPrompt(seeded, "Be precise.");

  assert.equal(updated.systemPrompt, "Be precise.");
  assert.equal(updated.conversations[0].systemPrompt, "Be precise.");
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
