# Architecture

## Domain ownership

| Domain | Location | Responsibility |
|---|---|---|
| Product UI | `apps/*` | User-facing web, desktop, mobile interfaces |
| AI gateway | `services/ai-gateway` | Provider routing, quotas, policy enforcement |
| Agent orchestration | `services/agent-orchestrator` | Task lifecycle, queues, tool policy, and audit events |
| Research | `services/research-worker` | Isolated research jobs and report output |
| Billing | `services/billing-ledger` | Usage accounting and payment adapter boundary |
| Shared contracts | `packages/contracts` | Versioned API/event schemas |

## Trust boundaries

Clients never receive provider secrets. Agent workloads execute with least privilege and only after versioned approval events grant bounded tools. The billing ledger only receives validated usage events and never wallet signing authority.
