# Canonical Trading + AI GitOps Contract

This directory defines the deployment contract for the consolidated ZeaZ trading/AI stack.

It is intentionally **disabled by default**. The placeholder workload is not a production release and must not be scaled above zero until release images are built and replaced by immutable digests.

Canonical ownership:
- intelligence / agents: `cvsz/zworkforce`
- deterministic execution / paper / risk: `cvsz/zksato`
- on-chain / wallet / DEX: `cvsz/zwallet`
- AI gateway: `cvsz/zaiman`
- dashboard: `cvsz/zdash`
- LINE operator adapter: `cvsz/zLinebot-automos`

## Release gates

Before enabling a workload:

1. build the canonical repository image;
2. record the source commit SHA;
3. scan the image and publish SBOM/provenance;
4. replace the placeholder image with an immutable `@sha256:...` reference;
5. provide secrets from the external secret manager;
6. verify health/readiness endpoints;
7. run paper/forward validation;
8. receive release approval.

No workload in this scaffold enables live trading.

## Network contract

The stack is internal-only. Public ingress stays outside these manifests. Services communicate using ClusterIP DNS and authenticated service credentials.

Expected flows:

```text
ztrader-intelligence -> zksato
ztrader-intelligence -> zwallet
ztrader-intelligence -> zaiman
zdash              -> ztrader-intelligence / zksato / zaiman
zlinebot-operator   -> ztrader-intelligence / zksato
```

`cvsz/zsme` is explicitly excluded from this deployment program.
