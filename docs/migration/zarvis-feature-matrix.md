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
| Append-only session transcript/events | Implemented | `zarvis.session.event.v1`, `FileSessionStore` | Fixed-path journals; mode 0600 files |
| Command idempotency | Implemented for read-only tools | `command_id` fingerprint/result envelope | Identical replay; conflicting reuse returns 409 |
| Session history view/delete | Implemented | `GET/DELETE /v1/sessions/{id}` | Owner service auth; deletion confirmation required |
| Durable multi-step task state | Implemented for read-only DAG | `services/zarvis-task-gateway`, durable agent adapters | Fixed owner; fixed-path job/queue/audit files |
| Exact-plan owner approval | Implemented for task plans | `zarvis.task.approval.v1`, SHA-256 digest + nonce | Single-use, 15-minute expiry, worker recheck |
| Pause/resume/cancel/retry | Implemented for task lifecycle | `ZarvisTaskRuntime` | Approved/pending pause only; retry limit enforced |
| Step checkpoints and dependency order | Implemented | `ZarvisPlanWorkerRuntime` | Earlier-step dependency rule; read-only registry |
| Owner-confirmed memory writes | Implemented | `services/zarvis-memory`, `zarvis.memory.proposal.v1` | Proposal has no effect until exact digest+nonce confirmation |
| Working/episodic/semantic/procedural memory | Implemented | `ZarvisMemoryRuntime` | Classification-specific retention limits |
| Encrypted memory at rest | Implemented | `EncryptedMemoryStore` | AES-256-GCM; external 32-byte master key; fixed journal path |
| Memory provenance and retrieval | Implemented | Memory snapshot schemas and lexical retriever | Owner-scoped, provenance returned, no persisted plaintext index |
| Memory correction/export/delete | Implemented | Privacy console and memory APIs | Versioned correction; owner export; journal compaction deletion |
| Secret-safe memory policy | Implemented | `assertMemorySafe` and tests | Raw credentials, private keys, tokens, and card-like data rejected |
| Memory retention purge | Implemented | Authenticated memory worker | Expired hidden immediately and physically compacted |
| Mutating tool execution | Blocked | Closed task tool registry | Phase 5 requires new capability contracts and security review |
| Screen/camera perception | Not implemented | Issue #153 | No capture permissions requested |
| Desktop/device control | Not implemented | Issue #154 | No action bridge |
| Proactive automation | Not implemented | Issue #155 | No schedules or background monitoring |
| Production deployment evidence | Not complete | Issue #156 | Edge, origin, rotation, backup, chaos, SLO evidence required |
