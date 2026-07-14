# Cloudflare Terraform Stack

This stack ports the active Cloudflare DNS-to-Tunnel ownership model from `cvsz/zeaz-platform` into `z-platform`.

## Scope

- Cloudflare provider v5.
- Proxied CNAME records targeting an existing Cloudflare Tunnel.
- A validated application-route contract.
- Generated cloudflared ingress and Phase 6 readiness URLs.
- No credentials, Terraform state, legacy backups, stale resources, or account tokens are copied.

The tunnel itself remains an existing account resource. Importing or recreating it is intentionally outside this initial migration to avoid replacing a live connector.

## Authentication

Use a scoped token through the environment. Never place it in a committed tfvars file.

```bash
export TF_VAR_cloudflare_api_token="$CLOUDFLARE_API_TOKEN"
```

Required permissions should be limited to the managed account/zone and the resources used by the plan.

## Configure

```bash
cd infrastructure/terraform/cloudflare
cp terraform.tfvars.example terraform.tfvars
chmod 600 terraform.tfvars
$EDITOR terraform.tfvars
```

Replace every zero/sample value with the real Cloudflare account ID, zone ID, tunnel UUID, hostnames, origins, and Access allow-list metadata.

## Validate and plan

```bash
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out=tfplan
terraform show -no-color tfplan
```

Review DNS ownership before applying. Existing records must be imported rather than duplicated:

```bash
terraform import 'cloudflare_dns_record.app_routes["phase6"]' '<zone-id>/<record-id>'
```

## Apply

```bash
terraform apply tfplan
terraform output -json cloudflared_ingress
terraform output -json phase6_urls
```

Merge the `cloudflared_ingress` output into the remotely managed tunnel configuration or the connector configuration owned by operations. The terminal `http_status:404` rule must remain last.

## Cloudflare-proxied Phase 6

With the tunnel route in place, Caddy/ACME is not required for `api6.zeaz.dev`. Cloudflare terminates public TLS and sends traffic through the tunnel to `http://phase6-api:8080`. This avoids exposing ports 80/443 on the private host.

Access policy resources are intentionally not created in this first port because the legacy repository contains competing provider-generation ownership models. `access_enabled` and allow-list metadata are validated now and are the contract for a follow-up Access module after the current account resources are imported and reconciled.
