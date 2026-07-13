const MAX_PROMPT_CHARACTERS = 12_000;

export class ChatRequestError extends Error {}

export function validateChatRequest(body) {
  if (!body || typeof body !== "object") {
    throw new ChatRequestError("Request body must be an object");
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "default";
  if (!prompt) throw new ChatRequestError("Prompt is required");
  if (prompt.length > MAX_PROMPT_CHARACTERS) {
    throw new ChatRequestError(`Prompt exceeds ${MAX_PROMPT_CHARACTERS} characters`);
  }
  if (!model) throw new ChatRequestError("Model is required");
  return { prompt, model };
}

function gatewayRequest(body, env, stream) {
  const { prompt, model } = validateChatRequest(body);
  const baseUrl = env.Z_PLATFORM_AI_GATEWAY_URL?.replace(/\/$/, "");
  const token = env.Z_PLATFORM_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    throw new ChatRequestError("AI gateway is not configured");
  }
  return [
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Accept: stream ? "text/event-stream" : "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  ];
}

async function gatewayFetch(body, { fetchImpl = fetch, env = process.env } = {}, stream) {
  let response;
  try {
    response = await fetchImpl(...gatewayRequest(body, env, stream));
  } catch {
    throw new ChatRequestError("AI gateway request failed");
  }
  if (!response.ok) throw new ChatRequestError("AI gateway rejected the request");
  return response;
}

export async function forwardChat(body, options = {}) {
  const response = await gatewayFetch(body, options, false);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ChatRequestError("AI gateway returned invalid JSON");
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ChatRequestError("AI gateway returned an unsupported response");
  }
  return { content };
}

export async function forwardChatStream(body, options = {}) {
  const response = await gatewayFetch(body, options, true);
  if (!response.body) {
    throw new ChatRequestError("AI gateway returned an empty stream");
  }
  return response.body;
}
