# Provider Reference

Canonical provider keys for prompt construction, configuration generation, and operator documentation.

| Key | Name | Documentation | Credential variable |
|---|---|---|---|
| `nvidia` | NVIDIA NIM | https://build.nvidia.com | `NVIDIA_NIM_API_KEY` |
| `groq` | Groq | https://console.groq.com/docs/models | `GROQ_API_KEY` |
| `cerebras` | Cerebras | https://inference-docs.cerebras.ai | `CEREBRAS_API_KEY` |
| `sambanova` | SambaNova | https://docs.sambanova.ai | `SAMBANOVA_API_KEY` |
| `openrouter` | OpenRouter | https://openrouter.ai/api/v1/models | `OPENROUTER_API_KEY` |
| `github-models` | GitHub Models | https://models.github.ai/catalog/models | `GITHUB_MODELS_TOKEN` |
| `mistral` | Mistral La Plateforme | https://docs.mistral.ai | `MISTRAL_API_KEY` |
| `codestral` | Codestral | https://codestral.mistral.ai | `CODESTRAL_API_KEY` |
| `scaleway` | Scaleway | https://www.scaleway.com/en/docs/ | `SCALEWAY_API_KEY` |
| `googleai` | Google AI Studio | https://ai.google.dev | `GEMINI_API_KEY` |
| `zai` | Z.ai | https://docs.z.ai | `ZAI_API_KEY` |
| `qwen` | Alibaba DashScope | https://help.aliyun.com/zh/model-studio/ | `DASHSCOPE_API_KEY` |
| `cloudflare` | Cloudflare Workers AI | https://developers.cloudflare.com/workers-ai/models/ | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` |
| `ovhcloud` | OVHcloud AI Endpoints | https://endpoints.ai.cloud.ovh.net | `OVHCLOUD_API_KEY` |
| `opencode-zen` | OpenCode Zen | https://opencode.ai/docs/zen/ | `OPENCODE_API_KEY` |

## Prompt-generation rules

- Use the exact `Key` value as the stable machine-facing identifier.
- Use the provider's current model catalog rather than embedding a permanent model list in prompts.
- Treat documentation URLs as references, not API base URLs unless the provider explicitly documents them as such.
- Never include populated credential values in generated prompts, logs, issues, artifacts, or committed files.
- Credential availability does not imply that the AI Gateway has a compatible transport adapter.
- Add providers to `UPSTREAM_PROVIDERS_JSON` only after confirming endpoint path, authentication scheme, request dialect, streaming behavior, upload support, quota semantics, and failover safety.

## Current gateway boundary

The current AI Gateway transport targets `/v1/chat/completions`. OpenAI-compatible providers can be configured through `UPSTREAM_PROVIDERS_JSON`. Native Anthropic Messages-only or provider-specific APIs require a dedicated transport adapter and verification before production use.
