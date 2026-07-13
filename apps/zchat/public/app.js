const model = document.querySelector("#model");
const prompt = document.querySelector("#prompt");
const send = document.querySelector("#send");
const logout = document.querySelector("#logout");
const result = document.querySelector("#result");
const status = document.querySelector("#status");

let conversationId = localStorage.getItem("zchat.conversationId") || crypto.randomUUID();
let sessionStartedAt = localStorage.getItem("zchat.sessionStartedAt") || String(Date.now());
localStorage.setItem("zchat.conversationId", conversationId);
localStorage.setItem("zchat.sessionStartedAt", sessionStartedAt);

async function loadModels() {
  try {
    const response = await fetch("/api/models");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load models");
    model.replaceChildren(...(data.data || []).map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.id;
      return option;
    }));
    status.textContent = "Ready";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Model catalog unavailable";
  }
}

send.onclick = async () => {
  send.disabled = true;
  result.textContent = "";
  status.textContent = "Sending";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Started-At": sessionStartedAt,
        "X-Usage-Correlation-Id": conversationId,
      },
      body: JSON.stringify({ model: model.value, prompt: prompt.value, conversation_id: conversationId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    conversationId = data.conversation_id || conversationId;
    localStorage.setItem("zchat.conversationId", conversationId);
    result.textContent = data.content;
    status.textContent = "Complete";
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : "Request failed";
    status.textContent = "Error";
  } finally {
    send.disabled = false;
  }
};

logout.onclick = async () => {
  await fetch("/api/logout", { method: "POST" });
  localStorage.removeItem("zchat.conversationId");
  localStorage.removeItem("zchat.sessionStartedAt");
  conversationId = crypto.randomUUID();
  sessionStartedAt = String(Date.now());
  localStorage.setItem("zchat.conversationId", conversationId);
  localStorage.setItem("zchat.sessionStartedAt", sessionStartedAt);
  result.textContent = "";
  status.textContent = "Logged out";
};

loadModels();
