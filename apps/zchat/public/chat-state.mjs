const STORAGE_KEYS = {
  conversationId: "zchat.conversationId",
  sessionStartedAt: "zchat.sessionStartedAt",
  model: "zchat.model",
  messages: "zchat.messages",
};

function safeJsonParse(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function createChatState(now = Date.now(), randomId = crypto.randomUUID) {
  return {
    conversationId: randomId(),
    sessionStartedAt: String(now),
    model: "",
    messages: [],
  };
}

export function loadChatState(storage, now = Date.now(), randomId = crypto.randomUUID) {
  const defaults = createChatState(now, randomId);
  const messages = safeJsonParse(storage.getItem(STORAGE_KEYS.messages), []);
  return {
    conversationId: storage.getItem(STORAGE_KEYS.conversationId) || defaults.conversationId,
    sessionStartedAt: storage.getItem(STORAGE_KEYS.sessionStartedAt) || defaults.sessionStartedAt,
    model: storage.getItem(STORAGE_KEYS.model) || "",
    messages: Array.isArray(messages) ? messages : [],
  };
}

export function persistChatState(storage, state) {
  storage.setItem(STORAGE_KEYS.conversationId, state.conversationId);
  storage.setItem(STORAGE_KEYS.sessionStartedAt, state.sessionStartedAt);
  storage.setItem(STORAGE_KEYS.model, state.model || "");
  storage.setItem(STORAGE_KEYS.messages, JSON.stringify(state.messages));
}

export function clearChatState(storage, now = Date.now(), randomId = crypto.randomUUID) {
  const state = createChatState(now, randomId);
  persistChatState(storage, state);
  return state;
}

export function appendMessage(state, message) {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

export function replaceMessage(state, messageId, updates) {
  return {
    ...state,
    messages: state.messages.map((message) => (message.id === messageId ? { ...message, ...updates } : message)),
  };
}

export function lastUserMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages[index];
    }
  }
  return null;
}

export { STORAGE_KEYS };
