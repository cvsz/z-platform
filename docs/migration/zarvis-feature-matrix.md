# Z.A.R.V.I.S. Feature Matrix

Epic: #148

| Capability | Status | Evidence | Security boundary |
|---|---|---|---|
| Typed text command | Implemented | `apps/zarvis-console/public/app.js` | Same-origin JSON proxy |
| Push-to-start browser voice transcript | Implemented, optional | `apps/zarvis-console/public/app.js` | No continuous listening; console uploads transcript only |
| Intent routing for GitHub repository status | Implemented | `services/zarvis-orchestrator/src/contracts.mjs` | Deterministic, constrained parser |
| Read-only GitHub status tool | Implemented | `services/zarvis-orchestrator/src/github-status-tool.mjs` | GET-only fixed host; no redirects |
| Speech-ready Thai/English response | Implemented | `services/zarvis-orchestrator/src/orchestrator.mjs` | Generated from normalized fields |
| Browser speech output | Implemented, optional | `apps/zarvis-console/public/app.js` | Browser speech synthesis |
| Tool audit event | Implemented | `zarvis.audit.tool-executed.v1` | Allowlisted fields; no secrets |
| Mutating tool approval | Not implemented | Future vertical slice | Mutations remain blocked |
| Durable task state | Not implemented | Future vertical slice | In-memory request lifecycle only |
| Episodic/semantic memory | Not implemented | Future vertical slice | No assistant memory in this slice |
| Screen/camera perception | Not implemented | Future vertical slice | No capture permissions requested |
| Desktop/device control | Not implemented | Future vertical slice | No action bridge |
| Proactive automation | Not implemented | Future vertical slice | No schedules or background monitoring |
