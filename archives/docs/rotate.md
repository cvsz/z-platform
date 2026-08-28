# Comprehensive Provider API Key Rotation Guide

This document lists **all provider API keys** detected across all `.env` files under `/home/cvsz/*/*.env.*`, along with direct dashboard URLs for generating, rotating, and managing API keys.

---

## 🤖 LLM & AI Model Providers

| Provider / Service | Environment Variable(s) | Key Generation / Rotation URL |
| :--- | :--- | :--- |
| **OpenAI** | `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY` | [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY`, `ANTHROPIC_ADMIN_API_KEY` | [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Google Gemini / AI Studio** | `GOOGLE_API_KEY`, `GEMINI_API_KEY` | [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| **DeepSeek** | `DEEPSEEK_API_KEY` | [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| **OpenRouter** | `OPENROUTER_API_KEY`, `OPENROUTER_ZBOT_API_KEY` | [https://openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) |
| **Alibaba DashScope (Qwen / Bailian)** | `DASHSCOPE_API_KEY`, `BAILIAN_TOKEN_PLAN_API_KEY` | [https://dashscope.console.aliyun.com/apiKey](https://dashscope.console.aliyun.com/apiKey) |
| **Groq** | `GROQ_API_KEY` | [https://console.groq.com/keys](https://console.groq.com/keys) |
| **xAI (Grok)** | `XAI_API_KEY` | [https://console.x.ai/](https://console.x.ai/) |
| **Perplexity AI** | `PERPLEXITY_API_KEY` | [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| **Fireworks AI** | `FIREWORKS_API_KEY` | [https://fireworks.ai/account/api-keys](https://fireworks.ai/account/api-keys) |
| **NVIDIA NIM / NGC** | `NVIDIA_API_KEY`, `NVIDIA_NIM_API_KEY`, `NGC_API_KEY` | [https://build.nvidia.com/](https://build.nvidia.com/) |
| **Cerebras AI** | `CEREBRAS_API_KEY` | [https://cloud.cerebras.ai/platform/keys](https://cloud.cerebras.ai/platform/keys) |
| **Together AI** | `TOGETHER_API_KEY` | [https://api.together.xyz/settings/api-keys](https://api.together.xyz/settings/api-keys) |
| **Mistral AI / Codestral** | `MISTRAL_API_KEY`, `CODESTRAL_API_KEY` | [https://console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) |
| **Kimi (Moonshot AI)** | `KIMI_API_KEY`, `MOONSHOT_API_KEY` | [https://platform.moonshot.cn/console/api-keys](https://platform.moonshot.cn/console/api-keys) |
| **MiniMax** | `MINIMAX_API_KEY` | [https://platform.minimaxi.com/user-center/basic-information/interface-key](https://platform.minimaxi.com/user-center/basic-information/interface-key) |
| **Novita AI** | `NOVITA_API_KEY` | [https://novita.ai/dashboard/key-management](https://novita.ai/dashboard/key-management) |
| **SambaNova Systems** | `SAMBANOVA_API_KEY` | [https://cloud.sambanova.ai/apis](https://cloud.sambanova.ai/apis) |
| **BytePlus (Volcengine Ark)** | `BYTEPLUS_API_KEY`, `ARK_API_KEY` | [https://console.byteplus.com/ark/region:ark+ap-southeast-1/endpoint](https://console.byteplus.com/ark/region:ark+ap-southeast-1/endpoint) |
| **ZAI (Zhipu AI / GLM)** | `ZAI_API_KEY`, `ZAI_API_KEY_ID` | [https://bigmodel.cn/usercenter/apikeys](https://bigmodel.cn/usercenter/apikeys) |
| **Hugging Face** | `HF_TOKEN`, `HF_TOKEN_API_KEY` | [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| **Hyperbolic** | `HYPERBOLIC_API_KEY` | [https://app.hyperbolic.xyz/settings](https://app.hyperbolic.xyz/settings) |
| **Friendli AI** | `FRIENDLI_TOKEN` | [https://suite.friendli.ai/team/tokens](https://suite.friendli.ai/team/tokens) |
| **Voyage AI (Embeddings)** | `VOYAGE_API_KEY` | [https://dash.voyageai.com/api-keys](https://dash.voyageai.com/api-keys) |
| **OKMD AI (KKU)** | `OKMD_API_KEY` | [https://gen.ai.kku.ac.th/okmd](https://gen.ai.kku.ac.th/okmd) |

---

## 🔍 Search, Scraping & Tools Providers

| Provider / Service | Environment Variable(s) | Key Generation / Rotation URL |
| :--- | :--- | :--- |
| **Firecrawl (Web Scraping)** | `FIRECRAWL_API_KEY` | [https://www.firecrawl.dev/app/api-keys](https://www.firecrawl.dev/app/api-keys) |
| **Brave Search API** | `BRAVE_API_KEY` | [https://api-dashboard.search.brave.com/app/keys](https://api-dashboard.search.brave.com/app/keys) |
| **Exa AI (Metaphor Search)** | `EXA_API_KEY` | [https://dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys) |

---

## ☁️ Cloud Infrastructure & Developer Platforms

| Provider / Service | Environment Variable(s) | Key Generation / Rotation URL |
| :--- | :--- | :--- |
| **GitHub / GitHub Models** | `GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_MODELS_TOKEN` | [https://github.com/settings/tokens](https://github.com/settings/tokens) |
| **Cloudflare** | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_TUNNEL_TOKEN` | [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) |
| **Supabase** | `SUPABASE_ACCESS_TOKEN` | [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| **Scaleway** | `SCALEWAY_API_KEY` | [https://console.scaleway.com/iam/api-keys](https://console.scaleway.com/iam/api-keys) |
| **OVHcloud** | `OVHCLOUD_API_KEY` | [https://www.ovh.com/manager/#/iam/tokens](https://www.ovh.com/manager/#/iam/tokens) |
| **DuckDNS** | `DUCKDNS_TOKEN` | [https://www.duckdns.org/domains](https://www.duckdns.org/domains) |
| **NPM Registry** | `NPM_API_KEY` | [https://www.npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens) |

---

## 📲 Social & Payment Integrations

| Provider / Service | Environment Variable(s) | Key Generation / Rotation URL |
| :--- | :--- | :--- |
| **Siam Commercial Bank (SCB)** | `SCB_API_KEY`, `SCB_TOKEN_ENCRYPTION_KEY` | [https://developer.scb.co.th/](https://developer.scb.co.th/) |
| **Meta / Facebook / Instagram** | `SOCIAL_FACEBOOK_ACCESS_TOKEN`, `SOCIAL_INSTAGRAM_ACCESS_TOKEN` | [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/) |
| **LinkedIn** | `SOCIAL_LINKEDIN_ACCESS_TOKEN` | [https://www.linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) |
| **TikTok** | `SOCIAL_TIKTOK_ACCESS_TOKEN` | [https://developers.tiktok.com/apps](https://developers.tiktok.com/apps) |
| **X (Twitter)** | `SOCIAL_X_API_KEY` | [https://developer.x.com/en/portal/dashboard](https://developer.x.com/en/portal/dashboard) |

---

## 🛡️ Key Rotation Lifecycle Instructions
1. **Rotate Key**: Visit the provider link, issue a replacement token, and delete/disable the old key.
2. **Update Environment**: Replace the target variable in `/home/cvsz/*/.env.*` (e.g. `/home/cvsz/qwen-gen/.env.ai`).
3. **Restart Services**: Reload containers to apply new keys:
   ```bash
   docker restart qwen-gen-litellm-1
   ```
