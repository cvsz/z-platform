# Migration Execution Records

## 2026-07-16 — CI pnpm Node 24 alignment

- Base revision: current branch head after the Node toolchain fix.
- Scope: one repository-local workflow compatibility slice.
- Implementation: updated the `ci`, `validate`, and `CodeQL Advanced` workflows to provision Node 24 before `pnpm install`, matching the repository's pinned `pnpm@11.4.0` requirement and eliminating the Node 20 / `node:sqlite` install failure.
- Compatibility: application code, provider isolation, production gates, and deployment workflows are unchanged.
- Security: no credentials, service tokens, or production identifiers were added; the change only adjusts the public Node runtime used by CI and CodeQL.
- Tests: `scripts/test/workflow-pnpm-setup.test.mjs` and `scripts/test/codeql-workflow.test.mjs` now assert the Node 24 setup step before pnpm installation.
- Limitations: repository-local validation only; GitHub Actions remains the source of truth for the exact head SHA's CI result.

## 2026-07-16 — CodeQL Advanced self-hosted runner lane

- Base revision: `1f44d9588fe4a42370f3477eea22a70e1e4cbd22`
- Scope: one repository-local CodeQL workflow slice.
- Implementation: updated `CodeQL Advanced` to run on the self-hosted `z-runner` lane and to load a repository CodeQL config that adds the `security-and-quality` query suite.
- Compatibility: the security workflow still analyzes the same repository languages and does not alter runtime application code, provider access, or production gates.
- Security: no credentials, service tokens, or production identifiers were added; the change only moves analysis to the designated CI runner and broadens query coverage.
- Tests: `scripts/test/codeql-workflow.test.mjs` now checks the runner label, config-file binding, and query-suite selection.
- Limitations: repository-local validation only; PR-head CodeQL execution, artifact binding, and alert-closure evidence on the self-hosted runner remain pending.

## 2026-07-16 — CodeQL Advanced workflow toolchain hardening

- Base revision: `743860cac1098e2a9ac258d542876a4d2acda7cc`
- Scope: one repository-local CodeQL workflow slice.
- Implementation: added explicit Node, pnpm, Go, and Python setup steps before CodeQL initialization so the self-hosted `z-runner` lane can analyze the repository without assuming preinstalled language toolchains.
- Compatibility: the workflow still targets the same languages and query suite; only analysis setup changed, and runtime application code, provider access, and production gates remain untouched.
- Security: the change only installs public toolchains and workspace dependencies needed for analysis; no credentials, service tokens, or production identifiers were added.
- Tests: `scripts/test/codeql-workflow.test.mjs` now checks the setup-node, pnpm, setup-go, and setup-python steps and their ordering before CodeQL init, plus the existing YAML parse check.
- Limitations: repository-local validation only; PR-head CodeQL execution, artifact binding, and alert-closure evidence on the self-hosted runner remain pending.
## 2026-07-16 — ZChat browser-local dark mode preference

- Base revision: `b34da941ef2c8d8e226cbf41e69675bcc4a050cb`
- Scope: one repository-local ZChat UI slice.
- Implementation: added a browser-local dark mode toggle with persisted preference and system-color-scheme fallback.
- Compatibility: transcript rendering, conversation history selection, manual titles, system prompts, prompt templates, export actions, retry, logout, and gateway-only forwarding remain unchanged.
- Security: browser code still receives no provider credentials or upstream base URLs; the theme preference is local browser state only.
- Tests: conversation-state coverage now includes theme preference normalization and persistence on the branch head.
- Limitations: repository-local validation only; no external staging or operator approval is claimed.

## 2026-07-16 — ZChat manual conversation title editing

- Base revision: `7035295df2bcd0b8c10f0a8e88f0db2edbe06ae3`
- Scope: one repository-local ZChat UI slice.
- Implementation: added a browser-editable conversation title field that persists with the active conversation, updates the history sidebar, and remains stable across later message appends.
- Compatibility: transcript rendering, history navigation, system prompts, prompt templates, export actions, retry, logout, and gateway-only forwarding remain unchanged.
- Security: browser code still receives no provider credentials or upstream base URLs; the title stays local to browser storage.
- Tests: conversation-state coverage now includes explicit title editing and persistence across later message appends on the branch head.
- Limitations: repository-local validation only; no external staging or operator approval is claimed.

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
