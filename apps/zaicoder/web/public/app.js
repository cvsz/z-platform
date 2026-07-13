const model = document.querySelector("#model");
const prompt = document.querySelector("#prompt");
const stream = document.querySelector("#stream");
const send = document.querySelector("#send");
const output = document.querySelector("#output");

function appendSseChunk(chunk, state) {
  state.buffer += chunk;
  const events = state.buffer.split("\n\n");
  state.buffer = events.pop();
  for (const event of events) {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const data = JSON.parse(payload);
        const text = data?.choices?.[0]?.delta?.content;
        if (typeof text === "string") output.textContent += text;
      } catch {
        // Ignore malformed provider keepalive frames.
      }
    }
  }
}

async function sendStreamingChat(body) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Streaming request failed");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = { buffer: "" };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    appendSseChunk(decoder.decode(value, { stream: true }), state);
  }
  appendSseChunk(decoder.decode(), state);
}

send.addEventListener("click", async () => {
  output.textContent = "";
  send.disabled = true;
  try {
    const body = { model: model.value, prompt: prompt.value };
    if (stream.checked) {
      await sendStreamingChat(body);
    } else {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed");
      output.textContent = result.content;
    }
  } catch (error) {
    output.textContent = error instanceof Error ? error.message : "Request failed";
  } finally {
    send.disabled = false;
  }
});
