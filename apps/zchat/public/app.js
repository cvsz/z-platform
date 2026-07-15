import {
  clearChatState,
  lastUserMessage,
  loadChatState,
  persistChatState,
  replaceMessage,
} from "./chat-state.mjs";
import { renderMarkdownFragment } from "./markdown.mjs";
import { readEventStream } from "./chat-stream.mjs";

const transcript = document.querySelector("#transcript");
const composer = document.querySelector("#composer");
const model = document.querySelector("#model");
const prompt = document.querySelector("#prompt");
const send = document.querySelector("#send");
const retry = document.querySelector("#retry");
const clear = document.querySelector("#clear");
const login = document.querySelector("#login");
const logout = document.querySelector("#logout");
const status = document.querySelector("#status");
const conversationLabel = document.querySelector("#conversation");
const emptyState = document.querySelector("#empty-state");

const storage = window.localStorage;

let state = loadChatState(storage);
let busy = false;

function setStatus(message, tone = "idle") {
  status.dataset.tone = tone;
  status.textContent = message;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  send.disabled = nextBusy;
  retry.disabled = nextBusy || !lastUserMessage(state.messages);
  clear.disabled = nextBusy;
  prompt.disabled = nextBusy;
}

function formatRole(role) {
  return role === "assistant" ? "ZChat" : "You";
}

function renderMessage(message) {
  const item = document.createElement("li");
  item.className = `message message--${message.role}${message.pending ? " is-pending" : ""}${message.error ? " is-error" : ""}`;
  item.dataset.role = message.role;
  item.id = message.id;

  const meta = document.createElement("div");
  meta.className = "message__meta";
  const role = document.createElement("span");
  role.className = "message__role";
  role.textContent = formatRole(message.role);
  const stamp = document.createElement("span");
  stamp.className = "message__stamp";
  stamp.textContent = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  meta.append(role, stamp);

  const body = document.createElement(message.role === "assistant" ? "div" : "pre");
  body.className = "message__body";
  if (message.role === "assistant" && message.content) {
    body.classList.add("markdown");
    body.replaceChildren(renderMarkdownFragment(document, message.content));
  } else {
    body.textContent = message.content || (message.pending ? "Streaming..." : "");
  }

  item.append(meta, body);
  return item;
}

function render() {
  transcript.replaceChildren(...state.messages.map(renderMessage));
  emptyState.hidden = state.messages.length > 0;
  conversationLabel.textContent = state.conversationId.slice(0, 8);
  model.value = state.model;
  retry.disabled = busy || !lastUserMessage(state.messages);
  clear.disabled = busy || state.messages.length === 0;
  if (state.messages.length) {
    transcript.scrollTop = transcript.scrollHeight;
  }
}

function createMessage(role, content, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    pending: overrides.pending ?? false,
    error: overrides.error ?? false,
  };
}

function syncConversationId(nextConversationId) {
  state = {
    ...state,
    conversationId: nextConversationId,
  };
  persistChatState(storage, state);
  conversationLabel.textContent = state.conversationId.slice(0, 8);
}

function readSelectedModel() {
  return model.value || state.model || "default";
}

async function loadModels() {
  try {
    const response = await fetch("/api/models");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load models");

    const options = (data.data || []).map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.id;
      return option;
    });

    model.replaceChildren(...options);

    const available = options.some((option) => option.value === state.model);
    if (!available && options.length) {
      state = {
        ...state,
        model: options[0].value,
      };
      persistChatState(storage, state);
    }

    model.value = state.model;
    setStatus(state.messages.length ? "Conversation ready" : "Ready", "ready");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Model catalog unavailable", "error");
  }
}

async function completeWithFallback(promptText, assistantId, requestBase) {
  const streamResponse = await fetch("/api/chat/stream", requestBase);
  if (streamResponse.ok && streamResponse.body) {
    const conversationId = streamResponse.headers.get("x-conversation-id");
    if (conversationId) {
      syncConversationId(conversationId);
    }

    const finalText = await readEventStream(streamResponse, (_, fullText) => {
      state = replaceMessage(state, assistantId, {
        content: fullText,
        pending: true,
        error: false,
      });
      persistChatState(storage, state);
      render();
    });

    state = replaceMessage(state, assistantId, {
      content: finalText,
      pending: false,
      error: false,
    });
    persistChatState(storage, state);
    render();
    return;
  }

  const fallbackResponse = await fetch("/api/chat", requestBase);
  const fallbackData = await fallbackResponse.json();
  if (!fallbackResponse.ok) {
    throw new Error(fallbackData.error || "Request failed");
  }

  if (fallbackData.conversation_id) {
    syncConversationId(fallbackData.conversation_id);
  }

  state = replaceMessage(state, assistantId, {
    content: fallbackData.content || "",
    pending: false,
    error: false,
  });
  persistChatState(storage, state);
  render();
}

async function sendMessage(promptText, { retrying = false } = {}) {
  if (busy) return;

  const trimmed = promptText.trim();
  if (!trimmed) {
    setStatus("Enter a message before sending", "error");
    return;
  }

  const userMessage = createMessage("user", trimmed);
  const assistantMessage = createMessage("assistant", "", { pending: true });
  const nextConversationId = state.conversationId || crypto.randomUUID();

  state = {
    ...state,
    conversationId: nextConversationId,
    model: readSelectedModel(),
    messages: [...state.messages, userMessage, assistantMessage],
  };
  persistChatState(storage, state);
  prompt.value = "";
  render();
  setBusy(true);
  setStatus(retrying ? "Retrying" : "Streaming", "busy");
  let requestSucceeded = false;

  try {
    await completeWithFallback(trimmed, assistantMessage.id, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Started-At": state.sessionStartedAt,
        "X-Usage-Correlation-Id": state.conversationId,
      },
      body: JSON.stringify({
        model: readSelectedModel(),
        prompt: trimmed,
        conversation_id: state.conversationId,
      }),
    });
    requestSucceeded = true;
  } catch (error) {
    state = replaceMessage(state, assistantMessage.id, {
      content: error instanceof Error ? error.message : "Request failed",
      pending: false,
      error: true,
    });
    persistChatState(storage, state);
    setStatus("Error", "error");
    render();
  } finally {
    setBusy(false);
    if (requestSucceeded) {
      setStatus(state.messages.length ? "Conversation ready" : "Ready", "ready");
    }
  }
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendMessage(prompt.value);
});

prompt.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

model.addEventListener("change", () => {
  state = {
    ...state,
    model: model.value,
  };
  persistChatState(storage, state);
});

retry.addEventListener("click", () => {
  const previous = lastUserMessage(state.messages);
  if (!previous) return;
  void sendMessage(previous.content, { retrying: true });
});

clear.addEventListener("click", () => {
  if (busy) return;
  state = clearChatState(storage);
  prompt.value = "";
  setStatus("Ready", "ready");
  render();
});

logout.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  state = clearChatState(storage);
  prompt.value = "";
  login.style.display = "inline-flex";
  logout.style.display = "none";
  setStatus("Logged out", "idle");
  render();
});

login.addEventListener("click", (event) => {
  event.preventDefault();
  setStatus("Redirecting to Cloudflare Access...", "busy");
  setTimeout(() => {
    login.style.display = "none";
    logout.style.display = "inline-flex";
    setStatus("Ready", "ready");
  }, 500);
});

login.style.display = "none";

state = {
  ...state,
  messages: Array.isArray(state.messages) ? state.messages : [],
};
persistChatState(storage, state);
render();
void loadModels();
