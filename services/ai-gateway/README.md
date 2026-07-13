# AI Gateway

The AI Gateway is the only platform service allowed to hold upstream model-provider credentials.

## Responsibilities

- Validate client identity, tenant scope and model entitlement
- Route approved requests to local or cloud model providers
- Enforce quotas, rate limits and tool policy
- Emit redacted audit and usage events
- Stream compatible responses to ZAI Coder, ZChat and IDE clients

## Prohibited responsibilities

- Storing browser-provided provider credentials
- Wallet signing or payment-card processing
- Executing arbitrary agent tools without an approved job policy
