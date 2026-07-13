const maxFilenameLength = 256;
const supportedUploadProviders = new Set(["openai", "openai-compatible"]);

export class UploadAdapterError extends Error {
  constructor(message, code = "invalid_upload") {
    super(message);
    this.name = "UploadAdapterError";
    this.code = code;
  }
}

export function normalizeUploadProvider(provider = "openai-compatible") {
  return String(provider || "openai-compatible").trim() || "openai-compatible";
}

export function normalizeUploadFilename(filename) {
  if (filename === undefined || filename === null || filename === "") return undefined;
  if (typeof filename !== "string") throw new UploadAdapterError("upload filename must be a string");

  const trimmed = filename.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxFilenameLength) throw new UploadAdapterError("upload filename is too long");
  if (/[\r\n]/.test(trimmed)) throw new UploadAdapterError("upload filename contains invalid characters");
  return trimmed;
}

export function validateUploadBody(body) {
  if (!Buffer.isBuffer(body)) throw new UploadAdapterError("upload body must be a buffer");
  if (body.length === 0) throw new UploadAdapterError("upload body is empty");
}

export function translateOpenAiCompatibleUpload(body, { contentType = "application/octet-stream", filename } = {}) {
  validateUploadBody(body);
  const safeFilename = normalizeUploadFilename(filename);
  return {
    path: "/v1/files",
    body,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      ...(safeFilename ? { "X-Filename": safeFilename } : {}),
    },
  };
}

export function translateAnthropicUpload() {
  throw new UploadAdapterError("binary file upload is not enabled for the anthropic provider", "unsupported_upload_provider");
}

const uploadAdapters = new Map([
  ["openai", translateOpenAiCompatibleUpload],
  ["openai-compatible", translateOpenAiCompatibleUpload],
  ["anthropic", translateAnthropicUpload],
]);

export function translateUploadRequest(body, options = {}) {
  const provider = normalizeUploadProvider(options.provider);
  const adapter = uploadAdapters.get(provider);
  if (!adapter) throw new UploadAdapterError(`unsupported upload provider: ${provider}`, "unsupported_upload_provider");
  return adapter(body, options);
}

export function uploadProviderSupportsBinary(provider = "openai-compatible") {
  return supportedUploadProviders.has(normalizeUploadProvider(provider));
}
