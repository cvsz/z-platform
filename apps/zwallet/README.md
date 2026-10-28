# ZWallet Adapter

ZWallet is a narrow billing adapter. It does not implement wallet signing, swaps, cards, KYC, MPC, private keys, or payment-provider credentials.

## Runtime contract

- `GET /health` reports adapter status and explicitly confirms no wallet/card authority.
- `POST /api/invoice-intents` is denied by default. Forwarding requires the explicit mutation gate, a valid assertion secret, a fresh signed tenant assertion, and a matching body digest.
- `POST /api/credits` always returns HTTP 503 until the ledger has a reviewed append-only credit-adjustment, audit, and idempotency contract. The general invoice-intent gate does not enable credit writes.

## Environment

- `Z_PLATFORM_BILLING_LEDGER_URL`
- `Z_PLATFORM_SERVICE_TOKEN` — outbound credential; never returned to callers
- `Z_PLATFORM_BILLING_ADAPTER_ENABLE_MUTATIONS` — leave unset/false until trusted-gateway and deployment gates are verified
- `Z_PLATFORM_TENANT_ASSERTION_SECRET` — high-entropy secret shared only by a trusted signer and this adapter

The current repository does not contain a verified trusted-gateway signer for this contract. Keep the mutation flag unset and the assertion secret undistributed until that signer, identity source, secret distribution, and private network path are implemented and independently reviewed.

## Tenant assertion contract

For each supported invoice-intent POST, the trusted gateway must send:

- `X-Authenticated-Tenant`: server-authorized tenant ID
- `X-Tenant-Assertion-Timestamp`: 10-digit Unix epoch seconds, within ±60 seconds
- `X-Tenant-Assertion-Signature`: lowercase hexadecimal HMAC-SHA256

The HMAC canonical message is UTF-8 with exactly one LF byte (U+000A) between these six fields:

1. tenant ID
2. timestamp
3. HTTP method
4. exact adapter path
5. idempotency key
6. lowercase SHA-256 digest of the exact raw request-body bytes

The gateway must sign the exact bytes it forwards and must not parse/re-serialize the body between signing and forwarding. Tenant IDs and idempotency keys containing control characters are rejected to avoid ambiguous canonical fields. The adapter validates the signature using constant-time comparison before making any ledger request.

The adapter is not a substitute for ingress isolation. Network policy must prevent untrusted callers from reaching the adapter directly, and the gateway must strip caller-supplied tenant assertion headers before inserting its own verified assertion.

## Failure, timeout, and retry contract

- Missing mutation configuration or assertion secret returns a generic, non-cacheable HTTP 503.
- Invalid or mismatched assertions return HTTP 403.
- Bodies are limited to 64 KiB; larger bodies return HTTP 413.
- Ledger requests have a bounded timeout (5 seconds by default; configurable from 100 through 30000 ms), do not follow redirects, and are not retried automatically.
- Upstream transport, authentication, timeout, redirect, throttling, or 5xx failures map to a generic HTTP 503 with `Cache-Control: no-store`; upstream error bodies and retry headers are not forwarded.
- A 503 does not establish whether a write committed. Reconcile with the ledger using the same durable operation-specific idempotency key before retrying.
- Credit mutation is disabled independently of the invoice-intent flag.

## Validation

Run `npm test` from this directory. Tests cover known-answer HMAC verification, tenant/path/timestamp/body/method/idempotency binding, fail-closed configuration, size limits, timeout/redirect behavior, and disabled credit mutation.

No production deployment, database migration, real payment, DNS change, or traffic cutover is authorized by this code change.
