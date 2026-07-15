const STORAGE_KEYS = {
  activeConversationId: "zchat.activeConversationId",
  conversationId: "zchat.conversationId",
  conversations: "zchat.conversations",
  model: "zchat.model",
  messages: "zchat.messages",
  sessionStartedAt: "zchat.sessionStartedAt",
};

function safeJsonParse(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toTimestamp(value, fallback = Date.now()) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function summarizeMessage(message) {
  const content = normalizeText(message?.content);
  if (!content) return "";
  return content.length > 64 ? `${content.slice(0, 64).trimEnd()}…` : content;
}

export function summarizeConversation(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const firstUserMessage = messages.find((message) => message?.role === "user" && normalizeText(message.content));
  const firstMessage = firstUserMessage || messages.find((message) => normalizeText(message.content));
  const title = normalizeText(conversation?.title) || summarizeMessage(firstMessage) || "New chat";
  const preview = summarizeMessage(messages[messages.length - 1]) || "No messages yet";

  return {
    id: conversation?.id || conversation?.conversationId || "",
    title,
    preview,
    model: typeof conversation?.model === "string" ? conversation.model : "",
    messageCount: messages.length,
    createdAt: toTimestamp(conversation?.createdAt),
    updatedAt: toTimestamp(conversation?.updatedAt),
    messages,
  };
}

function normalizeMessage(message) {
  return {
    id: typeof message?.id === "string" && message.id ? message.id : crypto.randomUUID(),
    role: message?.role === "assistant" ? "assistant" : "user",
    content: typeof message?.content === "string" ? message.content : "",
    createdAt: toTimestamp(message?.createdAt),
    pending: Boolean(message?.pending),
    error: Boolean(message?.error),
  };
}

export function createConversation(now = Date.now(), randomId = crypto.randomUUID, overrides = {}) {
  const id = typeof overrides.id === "string" && overrides.id ? overrides.id : randomId();
  return {
    id,
    title: typeof overrides.title === "string" && overrides.title.trim() ? overrides.title.trim() : "New chat",
    model: typeof overrides.model === "string" ? overrides.model : "",
    messages: Array.isArray(overrides.messages) ? overrides.messages.map(normalizeMessage) : [],
    createdAt: toTimestamp(overrides.createdAt, now),
    updatedAt: toTimestamp(overrides.updatedAt, now),
  };
}

function normalizeConversation(conversation, now = Date.now(), randomId = crypto.randomUUID) {
  return createConversation(now, randomId, {
    id: conversation?.id || conversation?.conversationId,
    title: conversation?.title,
    model: conversation?.model,
    messages: conversation?.messages,
    createdAt: conversation?.createdAt,
    updatedAt: conversation?.updatedAt,
  });
}

function sortConversations(conversations) {
  return [...conversations].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
    if (right.createdAt !== left.createdAt) return right.createdAt - left.createdAt;
    return left.id.localeCompare(right.id);
  });
}

function materializeState(state, now = Date.now(), randomId = crypto.randomUUID) {
  const hadConversationRecords = Array.isArray(state?.conversations) && state.conversations.length > 0;
  let conversations = Array.isArray(state?.conversations)
    ? state.conversations.map((conversation) => normalizeConversation(conversation, now, randomId))
    : [];

  const legacyMessages = Array.isArray(state?.messages)
    ? state.messages.map((message) => normalizeMessage(message))
    : [];

  if (!conversations.length) {
    const fallbackId = typeof state?.activeConversationId === "string" && state.activeConversationId
      ? state.activeConversationId
      : typeof state?.conversationId === "string" && state.conversationId
        ? state.conversationId
        : randomId();
    conversations = [createConversation(now, randomId, {
      id: fallbackId,
      model: typeof state?.model === "string" ? state.model : "",
      messages: legacyMessages,
      createdAt: state?.sessionStartedAt,
      updatedAt: state?.sessionStartedAt,
    })];
  }

  const activeConversationId = typeof state?.activeConversationId === "string" && state.activeConversationId
    ? state.activeConversationId
    : typeof state?.conversationId === "string" && state.conversationId
      ? state.conversationId
      : conversations[0].id;

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
  const activeModel = typeof state?.model === "string" && state.model
    ? state.model
    : activeConversation.model;
  const activeMessages = !hadConversationRecords && Array.isArray(state?.messages) && state.messages.length
    ? legacyMessages
    : activeConversation.messages;
  const resolvedConversations = conversations.map((conversation) => {
    if (conversation.id !== activeConversation.id) return conversation;
    return {
      ...conversation,
      model: activeModel,
      messages: activeMessages,
    };
  });
  const sortedConversations = sortConversations(resolvedConversations);

  return {
    activeConversationId: activeConversation.id,
    conversationId: activeConversation.id,
    sessionStartedAt: typeof state?.sessionStartedAt === "string" && state.sessionStartedAt ? state.sessionStartedAt : String(now),
    model: activeModel,
    messages: activeMessages,
    conversations: sortedConversations,
  };
}

function migrateLegacyState(storage, now = Date.now(), randomId = crypto.randomUUID) {
  const legacyMessages = safeJsonParse(storage.getItem(STORAGE_KEYS.messages), []);
  const conversation = createConversation(now, randomId, {
    id: storage.getItem(STORAGE_KEYS.conversationId) || storage.getItem(STORAGE_KEYS.activeConversationId),
    model: storage.getItem(STORAGE_KEYS.model) || "",
    messages: Array.isArray(legacyMessages) ? legacyMessages : [],
    createdAt: toTimestamp(storage.getItem(STORAGE_KEYS.sessionStartedAt), now),
    updatedAt: now,
  });

  return materializeState({
    activeConversationId: conversation.id,
    sessionStartedAt: storage.getItem(STORAGE_KEYS.sessionStartedAt) || String(now),
    conversations: [conversation],
  }, now, randomId);
}

function withActiveConversation(state, updater, now = Date.now(), randomId = crypto.randomUUID) {
  const normalized = materializeState(state, now, randomId);
  const nextConversations = normalized.conversations.map((conversation) => {
    if (conversation.id !== normalized.activeConversationId) return conversation;
    return normalizeConversation(updater(conversation), now, randomId);
  });

  return materializeState({
    ...normalized,
    conversations: nextConversations,
  }, now, randomId);
}

function updateConversationById(state, conversationId, updater, now = Date.now(), randomId = crypto.randomUUID) {
  const normalized = materializeState(state, now, randomId);
  const nextConversations = normalized.conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    return normalizeConversation(updater(conversation), now, randomId);
  });

  return materializeState({
    ...normalized,
    conversations: nextConversations,
  }, now, randomId);
}

export function createChatState(now = Date.now(), randomId = crypto.randomUUID) {
  const conversationId = randomId();
  return materializeState({
    activeConversationId: conversationId,
    conversationId,
    sessionStartedAt: String(now),
    conversations: [createConversation(now, randomId, { id: conversationId })],
  }, now, randomId);
}

export function loadChatState(storage, now = Date.now(), randomId = crypto.randomUUID) {
  const conversations = safeJsonParse(storage.getItem(STORAGE_KEYS.conversations), null);
  if (Array.isArray(conversations) && conversations.length > 0) {
    return materializeState({
      activeConversationId: storage.getItem(STORAGE_KEYS.activeConversationId) || storage.getItem(STORAGE_KEYS.conversationId) || conversations[0]?.id,
      sessionStartedAt: storage.getItem(STORAGE_KEYS.sessionStartedAt) || String(now),
      conversations,
    }, now, randomId);
  }

  return migrateLegacyState(storage, now, randomId);
}

export function persistChatState(storage, state) {
  const normalized = materializeState(state);
  storage.setItem(STORAGE_KEYS.activeConversationId, normalized.activeConversationId);
  storage.setItem(STORAGE_KEYS.conversationId, normalized.conversationId);
  storage.setItem(STORAGE_KEYS.sessionStartedAt, normalized.sessionStartedAt);
  storage.setItem(STORAGE_KEYS.model, normalized.model || "");
  storage.setItem(STORAGE_KEYS.messages, JSON.stringify(normalized.messages));
  storage.setItem(STORAGE_KEYS.conversations, JSON.stringify(normalized.conversations));
}

export function clearChatState(storage, now = Date.now(), randomId = crypto.randomUUID) {
  const state = createChatState(now, randomId);
  persistChatState(storage, state);
  return state;
}

export function getActiveConversation(state) {
  const normalized = materializeState(state);
  return normalized.conversations.find((conversation) => conversation.id === normalized.activeConversationId) || normalized.conversations[0];
}

export function selectConversation(state, conversationId, now = Date.now(), randomId = crypto.randomUUID) {
  const normalized = materializeState(state, now, randomId);
  const selected = normalized.conversations.find((conversation) => conversation.id === conversationId);
  if (!selected) return normalized;

  return materializeState({
    ...normalized,
    activeConversationId: selected.id,
  }, now, randomId);
}

export function startNewConversation(state, now = Date.now(), randomId = crypto.randomUUID) {
  const normalized = materializeState(state, now, randomId);
  const nextConversation = createConversation(now, randomId, {
    model: normalized.model,
  });
  return materializeState({
    ...normalized,
    activeConversationId: nextConversation.id,
    conversations: [nextConversation, ...normalized.conversations],
  }, now, randomId);
}

export function renameActiveConversation(state, conversationId, now = Date.now(), randomId = crypto.randomUUID) {
  const normalized = materializeState(state, now, randomId);
  if (!conversationId || conversationId === normalized.activeConversationId) {
    return normalized;
  }

  const nextConversations = normalized.conversations.map((conversation) => {
    if (conversation.id !== normalized.activeConversationId) return conversation;
    return {
      ...conversation,
      id: conversationId,
      updatedAt: now,
    };
  });

  return materializeState({
    ...normalized,
    activeConversationId: conversationId,
    conversations: nextConversations,
  }, now, randomId);
}

export function clearActiveConversation(state, now = Date.now(), randomId = crypto.randomUUID) {
  return withActiveConversation(state, (conversation) => ({
    ...conversation,
    title: "New chat",
    messages: [],
    updatedAt: now,
  }), now, randomId);
}

export function appendMessage(state, message, now = Date.now(), randomId = crypto.randomUUID) {
  return withActiveConversation(state, (conversation) => {
    const nextMessages = [...conversation.messages, normalizeMessage(message)];
    const title = conversation.title === "New chat" && nextMessages.some((item) => item.role === "user")
      ? summarizeMessage(nextMessages.find((item) => item.role === "user"))
      : conversation.title;
    return {
      ...conversation,
      title: title || "New chat",
      messages: nextMessages,
      updatedAt: now,
    };
  }, now, randomId);
}

export function replaceMessage(state, messageId, updates, now = Date.now(), randomId = crypto.randomUUID) {
  return withActiveConversation(state, (conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => (message.id === messageId ? {
      ...message,
      ...updates,
      createdAt: toTimestamp(updates?.createdAt, message.createdAt),
      pending: Boolean(updates?.pending ?? message.pending),
      error: Boolean(updates?.error ?? message.error),
    } : message)),
    updatedAt: now,
  }), now, randomId);
}

export function lastUserMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages[index];
    }
  }
  return null;
}

export function activeConversationSummary(state) {
  return summarizeConversation(getActiveConversation(state));
}

export function conversationSummaries(state) {
  return materializeState(state).conversations.map((conversation) => summarizeConversation(conversation));
}

export { STORAGE_KEYS };
