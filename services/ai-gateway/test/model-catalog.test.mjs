import assert from "node:assert/strict";
import test from "node:test";

import { findModel, huggingFaceFreeModels, listModels } from "../model-catalog.mjs";

test("catalog exposes Hugging Face free/local model entries", () => {
  assert.ok(huggingFaceFreeModels.length >= 10);
  assert.ok(huggingFaceFreeModels.every((model) => model.id.startsWith("hf:")));
  assert.ok(huggingFaceFreeModels.every((model) => model.provider === "huggingface"));
  assert.ok(huggingFaceFreeModels.every((model) => model.repo.includes("/")));
  assert.ok(huggingFaceFreeModels.every((model) => ["apache-2.0", "mit"].includes(model.license)));
});

test("catalog returns OpenAI-compatible list shape", () => {
  const catalog = listModels();
  assert.equal(catalog.object, "list");
  assert.ok(catalog.data.length >= 10);
  assert.ok(catalog.data.every((model) => model.object === "model"));
});

test("catalog can resolve by public id or Hugging Face repo", () => {
  assert.equal(findModel("hf:Qwen/Qwen2.5-7B-Instruct")?.repo, "Qwen/Qwen2.5-7B-Instruct");
  assert.equal(findModel("microsoft/Phi-3-small-8k-instruct")?.id, "hf:microsoft/Phi-3-small-8k-instruct");
});
