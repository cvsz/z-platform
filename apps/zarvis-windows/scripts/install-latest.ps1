[CmdletBinding()]
param(
    [string]$Repository = 'cvsz/z-platform'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI is required. Install it with: winget install GitHub.cli'
}

gh auth status | Out-Null
$temp = Join-Path $env:TEMP "zarvis-update-$([Guid]::NewGuid())"
New-Item $temp -ItemType Directory -Force | Out-Null

try {
    & gh release download --repo $Repository --dir $temp `
        --pattern 'ZARVIS-Setup-*-win-x64.exe' `
        --pattern 'SHA256SUMS.txt'
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub release download failed with exit code $LASTEXITCODE."
    }

    $installer = Get-ChildItem $temp -Filter 'ZARVIS-Setup-*-win-x64.exe' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $installer) {
        throw 'No Z.A.R.V.I.S. installer was found in the latest release.'
    }

    $sumFile = Join-Path $temp 'SHA256SUMS.txt'
    $expectedLine = Get-Content $sumFile |
        Where-Object { $_ -match [Regex]::Escape($installer.Name) } |
        Select-Object -First 1
    if (-not $expectedLine) {
        throw "Checksum for $($installer.Name) is missing."
    }

    $expected = ($expectedLine -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -ne $actual) {
        throw "Checksum mismatch for $($installer.Name)."
    }

    Start-Process $installer.FullName -Wait
}
finally {
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
