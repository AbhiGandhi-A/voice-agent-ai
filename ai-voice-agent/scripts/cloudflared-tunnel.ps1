# cloudflared-tunnel.ps1 — expose the local backend at :3000 via a public HTTPS URL.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\cloudflared-tunnel.ps1
# Requires: cloudflared.exe on PATH (https://github.com/cloudflare/cloudflared/releases)
# This uses Cloudflare's QUICK tunnel (trycloudflare.com) — no account needed,
# but the public URL changes on every restart and is development/testing infra.
# For a STABLE production URL: create a named tunnel in your Cloudflare dashboard
# (cloudflared tunnel create <name>; cloudflared tunnel route dns <name> app.example.com)
# and run `cloudflared tunnel run <name>` with a matching config.yml.
#
# WebSockets (wss://) are proxied by cloudflared automatically — the backend's
# real-time media/telephony endpoints work through this tunnel unchanged.

param(
  [int]$Port = 3000
)

$ollama = "http://127.0.0.1:11434/api/tags"
if (Test-Path $env:USERPROFILE\scoop\shims\ollama.exe) { Write-Host "" }
try { Invoke-RestMethod $ollama -TimeoutSec 2 | Out-Null } catch {
  Write-Host "WARN: Ollama not reachable on 11434 - start it first (ollama serve / the Ollama app)." -ForegroundColor Yellow
}

$cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredPath = if ($cloudflaredCommand) { $cloudflaredCommand.Source } else {
  @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
    "$env:LOCALAPPDATA\cloudflared\cloudflared.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $cloudflaredPath) {
  Write-Error "cloudflared was not found on PATH or in the standard install locations. Install it: winget install --id Cloudflare.cloudflared"
  exit 1
}

Write-Host "Starting Cloudflare quick tunnel -> http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host "Watch the log for a 'https://<random>.trycloudflare.com' URL." -ForegroundColor Cyan
& $cloudflaredPath tunnel --url "http://127.0.0.1:$Port"