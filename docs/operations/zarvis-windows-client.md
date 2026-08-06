# Z.A.R.V.I.S. Windows Client Operations

## Purpose

`ZARVIS.exe` is a native Windows 11 control client for the single-owner local
Z.A.R.V.I.S. deployment. It does not convert the Ubuntu services into public
services. It manages Windows OpenSSH local forwarding and opens the existing
Action and Proactive web consoles on Windows loopback.

## Supported topology

```text
Windows 11 ZARVIS.exe
  127.0.0.1:8098 ─┐
  127.0.0.1:8099 ─┴─ encrypted SSH ─> Ubuntu/VM 127.0.0.1:8098/8099
```

The Ubuntu host remains owner-bound to GitHub numeric ID `4076926`.

## Prerequisites

- Windows 11 x64
- Windows OpenSSH Client
- SSH key or Windows `ssh-agent`
- network reachability to the Ubuntu SSH port
- completed Z.A.R.V.I.S. actual-host automated validation

Install OpenSSH when absent:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

## Build and release from the Ubuntu server

The server-side operator command dispatches the private Windows release
workflow through authenticated GitHub CLI:

```bash
bash scripts/zarvis-windows-release.sh 0.1.0
```

The workflow builds and tests the app on `windows-latest`, optionally signs it,
creates the installer and SHA-256 manifest, attests the artifact, and publishes
a private GitHub Release.

## Install on Windows

```powershell
winget install GitHub.cli
gh auth login
pwsh .\apps\zarvis-windows\scripts\install-latest.ps1
```

Or download the installer from the private GitHub Release and verify it against
`SHA256SUMS.txt`.

## Credential handling

- Do not put the Owner Token into `settings.json`.
- Do not add the Owner Token to Windows environment variables.
- Do not include it in screenshots or support logs.
- The Copy Owner Token action performs one SSH command and clears the clipboard
  after 60 seconds when the clipboard still contains the same token.
- Rotate server credentials after suspected clipboard, SSH, or desktop compromise.

## Code signing

Production distribution requires a trusted Authenticode certificate. Configure:

- `WINDOWS_SIGNING_CERT_PFX_BASE64`
- `WINDOWS_SIGNING_CERT_PASSWORD`

The workflow signs both `ZARVIS.exe` and the installer when these secrets are
available. Without them, artifacts are explicitly marked unsigned.

## Rollback

Install an earlier private GitHub Release. Client rollback does not modify
server durable state. Stop the tunnel before replacing the client binary.
