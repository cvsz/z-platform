# Trading + AI Runtime Ownership

z-platform is the production/GitOps destination for the consolidated ZeaZ trading stack.

Target deployables:
- ztrader-intelligence
- zksato
- zwallet read-only evidence adapters
- zaiman
- zdash
- zLinebot operator adapter
- PostgreSQL / Redis
- Prometheus / Grafana / Loki / Tempo

Promotion flow:
```text
GitHub -> CI -> GHCR -> ArgoCD -> k3s
```

Production requirements:
- secrets outside Git
- pinned images
- health/readiness probes
- NetworkPolicy
- explicit resource limits
- backup/restore evidence
- rollback/runbook evidence
- no duplicate legacy trading service promoted

Live trading remains disabled until backtest, OOS, paper and forward-validation gates pass.

Explicit exclusion: `cvsz/zsme` is out of scope.
