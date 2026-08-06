# Z.A.R.V.I.S. Feature Matrix

Epic: #148

| Capability | Status | Evidence | Security boundary |
|---|---|---|---|
| Typed text command | Implemented | `apps/zarvis-console/public/app.js` | Same-origin owner-only JSON proxy |
| Browser push-to-start transcript | Implemented | `apps/zarvis-console/public/app.js` | No continuous listening |
| Realtime ZVoice transcript bridge | Implemented | `apps/zvoice/server.mjs`, `apps/zvoice/public/app.js` | Edge assertion; fixed owner identity; no browser secret |
| Intent routing for GitHub repository status | Implemented | `services/zarvis-orchestrator/src/contracts.mjs` | Deterministic constrained parser |
| Read-only GitHub status tool | Implemented | `services/zarvis-orchestrator/src/github-status-tool.mjs` | GET-only fixed host; no redirects |
| Speech-ready Thai/English response | Implemented | `services/zarvis-orchestrator/src/orchestrator.mjs` | Generated from normalized fields |
| Browser speech output | Implemented | Console and ZVoice browser clients | Browser speech synthesis |
| Tool audit event | Implemented | `zarvis.audit.tool-executed.v1` | Allowlisted fields; no secrets |
| Append-only session transcript/events | Implemented | `zarvis.session.event.v1`, `FileSessionStore` | Owner-only storage; mode 0600 files |
| Command idempotency | Implemented for read-only tools | `command_id` fingerprint/result envelope | Identical replay; conflicting reuse returns 409 |
| Session history view/delete | Implemented | `GET/DELETE /v1/sessions/{id}` | Owner service auth; deletion confirmation required |
| Mutating tool approval | Not implemented | Next vertical slice | Mutations remain blocked |
| Durable multi-step task state | Not implemented | Next vertical slice | Current durability is command/session scoped |
| Episodic/semantic memory | Not implemented | Future vertical slice | Only explicit session transcript storage exists |
| Screen/camera perception | Not implemented | Future vertical slice | No capture permissions requested |
| Desktop/device control | Not implemented | Future vertical slice | No action bridge |
| Proactive automation | Not implemented | Future vertical slice | No schedules or background monitoring |
