# Migration Execution Records

## 2026-07-16 — ZChat active conversation export controls

- Base revision: `412ef335ca2b2166b8bd83acdab0d46fa356b9b1`
- Scope: one repository-local ZChat UI slice.
- Implementation: added active-conversation export helpers plus UI controls to copy the current chat as markdown or download it as JSON.
- Compatibility: transcript rendering, conversation history selection, pinned system prompts, prompt templates, retry, logout, and gateway-only forwarding remain unchanged.
- Security: browser code still receives no provider credentials or upstream base URLs; export output only reflects browser-local conversation content.
- Tests: conversation-state coverage now includes markdown and JSON export serialization on the branch head.
- Limitations: repository-local validation only; no external staging or operator approval is claimed.

## 2026-07-16 — ZChat browser-local prompt template library

- Base revision: `ca0caff`
- Scope: one repository-local ZChat UI slice.
- Implementation: added a browser-local prompt template library with built-in presets, custom template saving, per-template reuse, and a "start from template" path that creates a fresh chat and sends the selected prompt.
- Compatibility: transcript rendering, conversation history selection, pinned system prompts, retry, logout, and gateway-only forwarding remain unchanged.
- Security: browser code still receives no provider credentials or upstream base URLs; custom templates stay local to browser storage.
- Tests: conversation-state coverage now includes template default loading, template persistence, and template removal on the branch head.
- Limitations: repository-local validation only; no external staging or operator approval is claimed.

## 2026-07-16 — ZChat pinned system prompt support

- Base revision: `c4edcf86a748e4420b4b64fb0e3d6619df712d16`
- Scope: one repository-local ZChat UI slice.
- Implementation: added a browser-persisted per-conversation system prompt editor and forwarded it through the zchat chat and streaming request paths as a system message before the user message.
- Compatibility: transcript rendering, conversation history selection, retry, logout, and gateway-only model forwarding remain unchanged; legacy flat browser storage still hydrates into the new prompt-aware conversation container.
- Security: browser code still receives no provider credentials or upstream base URLs, and non-string system prompts are rejected server-side before the gateway call.
- Tests: conversation-state coverage now includes system prompt persistence and selection, and server tests now verify system-message forwarding and invalid prompt rejection on the branch head.
- Limitations: repository-local validation only; no external staging or operator approval is claimed.

## 2026-07-16 — ZChat conversation history sidebar and new chat control

- Base revision: `8d92346446a70aebeb918c1bd670904f00147fbc`
- Scope: one repository-local ZChat UI slice.
- Implementation: added a browser-local conversation history sidebar with active-conversation selection, a dedicated new-chat action, active-conversation clearing, and conversation metadata summaries.
- Compatibility: transcript rendering, stream handling, retry, logout, and gateway-only model forwarding remain unchanged; legacy flat browser storage still hydrates into the new history container.
- Security: browser code still receives no provider credentials or upstream base URLs.
- Tests: conversation-state coverage now includes history hydration, selection, reset, and server-id rebasing on the branch head.
- Limitations: repository-local validation only; no external staging or operator approval is claimed.

## 2026-07-16 — ZChat safe markdown rendering upgrade

- Base revision: `b43140e26d3ec0dc2a38ae5e5805989d2f393e3d`
- Scope: one repository-local ZChat UI slice.
- Implementation: added a safe markdown renderer for assistant replies, with code fences, headings, lists, quotes, inline formatting, and link allowlisting for http(s) URLs.
- Compatibility: transcript rendering, browser storage state, streaming replies, and gateway-only model forwarding remain unchanged.
- Security: raw HTML and dangerous URL schemes remain text-only; no provider credentials or external auth state were added to the browser.
- Tests: focused markdown tokenization and rendering tests, plus the existing zchat suite, passed on the branch head.
- Limitations: repository-local validation only; no external staging or operator approval is claimed.

## 2026-07-16 — ZChat conversation transcript and streaming composer upgrade

- Base revision: `50054c26accc0b9903179e4fae0dac6acf174dd0`
- Scope: one repository-local ZChat UI slice.
- Implementation: replaced the single-message form with a transcript-based conversation shell, browser-persisted conversation state, retry/clear controls, and streaming assistant rendering with a gateway fallback path.
- Compatibility: gateway-only model catalog loading, tenant/session correlation, logout clearing, and server-side provider isolation remain unchanged.
- Security: browser code still receives no provider credentials or upstream base URLs.
- Tests: `node --test apps/zchat/test`, `node --test apps/zchat/test/server.test.mjs`, and repo pre-push validation passed on the branch head.
- Limitations: isolated repository validation only; no external staging or operator approval is claimed.

## 2026-07-15 — AI Gateway disconnect-aware upstream cancellation

- Base revision: `36fc7f594c933137a1d8da2855bac752fb2f03b3`
- Scope: one repository-local AI Gateway slice.
- Implementation: wrapped the gateway in an exportable factory, propagated client disconnects to the upstream fetch through `AbortController`, and stopped retrying once the request closed.
- Compatibility: service-token auth, exact-origin CORS, provider routing, and existing gateway request contracts remain unchanged.
- Tests: `pnpm --dir services/ai-gateway test`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm keys:check`, `docker compose config --quiet`, and `docker compose build ai-gateway`.
- Limitations: repository-local validation only; no external staging, operator approval, or production readiness is claimed.

## 2026-07-15 — Immutable release evidence binding

- Base revision: `f5be49853ec9311c81f9e62892b4d7f2db4bc254`
- Scope: one Phase 6 release-safety vertical slice.
- Implementation: added a dependency-free validator that requires `commitSha`, `approvedCommitSha`, and `observedCommitSha` to equal the exact release-candidate SHA.
- Compatibility: existing release templates and runtime interfaces are unchanged.
- Security: no provider SDKs, credentials, external traffic, deployment, or financial authority added.
- Tests: positive exact-match case plus stale, placeholder, missing-field, and invalid-argument regressions.
