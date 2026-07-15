const decoder = new TextDecoder();

function decodeEventData(data) {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") return "";
  try {
    const payload = JSON.parse(trimmed);
    const choice = payload?.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content ?? payload?.delta?.content ?? payload?.content;
    return typeof delta === "string" ? delta : "";
  } catch {
    return trimmed;
  }
}

export function extractDeltaText(chunk) {
  return chunk
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => decodeEventData(line.slice(5)))
    .join("");
}

export async function readEventStream(response, onDelta) {
  if (!response.body) {
    throw new Error("Streaming response unavailable");
  }

  const reader = response.body.getReader();
  let buffer = "";
  let emitted = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const event = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      const delta = extractDeltaText(event);
      if (delta) {
        emitted += delta;
        onDelta(delta, emitted);
      }
      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const delta = extractDeltaText(buffer);
    if (delta) {
      emitted += delta;
      onDelta(delta, emitted);
    }
  }

  return emitted;
}
