const maxAttachments = 20;

export class AttachmentAdapterError extends Error {
  constructor(message, code = "invalid_attachments") {
    super(message);
    this.name = "AttachmentAdapterError";
    this.code = code;
  }
}

export function validateAttachmentReferences(attachments) {
  if (attachments === undefined) return [];
  if (!Array.isArray(attachments)) throw new AttachmentAdapterError("attachments must be an array");
  if (attachments.length > maxAttachments) throw new AttachmentAdapterError("too many attachments");

  return attachments.map((attachment) => {
    if (!attachment || typeof attachment !== "object") throw new AttachmentAdapterError("attachments require id and name");
    if (typeof attachment.id !== "string" || !attachment.id.trim()) throw new AttachmentAdapterError("attachments require id and name");
    if (typeof attachment.name !== "string" || !attachment.name.trim()) throw new AttachmentAdapterError("attachments require id and name");

    return {
      id: attachment.id.trim(),
      name: attachment.name.trim(),
      ...(typeof attachment.mime_type === "string" && attachment.mime_type.trim() ? { mime_type: attachment.mime_type.trim() } : {}),
      ...(Number.isSafeInteger(attachment.size_bytes) && attachment.size_bytes >= 0 ? { size_bytes: attachment.size_bytes } : {}),
    };
  });
}

export function attachmentReferenceText(attachments) {
  return attachments.map((attachment) => {
    const parts = [`${attachment.name} (${attachment.id})`];
    if (attachment.mime_type) parts.push(attachment.mime_type);
    if (Number.isSafeInteger(attachment.size_bytes)) parts.push(`${attachment.size_bytes} bytes`);
    return `- ${parts.join("; ")}`;
  }).join("\n");
}

function zPlatformMetadata(payload, attachments) {
  return {
    ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
    z_platform: {
      ...((payload.metadata?.z_platform && typeof payload.metadata.z_platform === "object") ? payload.metadata.z_platform : {}),
      attachments,
    },
  };
}

export function translateOpenAiCompatiblePayload(payload, attachments) {
  const lines = attachmentReferenceText(attachments);
  const suffix = `\n\nAttached platform files:\n${lines}`;
  const messages = Array.isArray(payload.messages) ? payload.messages.map((message) => ({ ...message })) : [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user" && typeof messages[index].content === "string") {
      messages[index].content += suffix;
      return { ...payload, attachments: undefined, messages, metadata: zPlatformMetadata(payload, attachments) };
    }
  }

  return {
    ...payload,
    attachments: undefined,
    messages: [...messages, { role: "user", content: `Attached platform files:\n${lines}` }],
    metadata: zPlatformMetadata(payload, attachments),
  };
}

export function translateAnthropicMessagesPayload(payload, attachments) {
  const lines = attachmentReferenceText(attachments);
  const block = { type: "text", text: `Attached platform files:\n${lines}` };
  const messages = Array.isArray(payload.messages) ? payload.messages.map((message) => ({ ...message })) : [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== "user") continue;
    const content = messages[index].content;
    messages[index].content = Array.isArray(content) ? [...content, block] : [{ type: "text", text: String(content || "") }, block];
    return { ...payload, attachments: undefined, messages, metadata: zPlatformMetadata(payload, attachments) };
  }

  return {
    ...payload,
    attachments: undefined,
    messages: [...messages, { role: "user", content: [block] }],
    metadata: zPlatformMetadata(payload, attachments),
  };
}

const adapters = new Map([
  ["openai", translateOpenAiCompatiblePayload],
  ["openai-compatible", translateOpenAiCompatiblePayload],
  ["anthropic", translateAnthropicMessagesPayload],
]);

export function translateAttachmentPayload(payload, { provider = "openai-compatible" } = {}) {
  const attachments = validateAttachmentReferences(payload.attachments);
  if (attachments.length === 0) return payload;

  const adapter = adapters.get(provider);
  if (!adapter) throw new AttachmentAdapterError(`unsupported attachment provider: ${provider}`, "unsupported_attachment_provider");

  const translated = adapter(payload, attachments);
  delete translated.attachments;
  return translated;
}

export function translateAttachmentBuffer(buffer, contentType = "application/json", options = {}) {
  if (!contentType.includes("application/json")) return buffer;

  let payload;
  try {
    payload = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Chat request body must be valid JSON"), { code: "invalid_json" });
  }

  const translated = translateAttachmentPayload(payload, options);
  if (translated === payload) return buffer;
  return Buffer.from(JSON.stringify(translated));
}
