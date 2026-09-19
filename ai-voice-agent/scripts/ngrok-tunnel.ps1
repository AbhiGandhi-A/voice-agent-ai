# ngrok-tunnel.ps1 — expose the local backend at :3000 via an ngrok HTTPS URL.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\ngrok-tunnel.ps1
# Requires: ngrok.exe on PATH (https://ngrok.com/download) and `ngrok config add-authtoken <token>` once.
# Free tier generates a NEW random *.ngrok-free.app URL on each start (development/testing).
# For a stable URL: upgrade and pin it with `--url=https://your-domain.ngrok-free.app`.
#
# ngrok forwards WebSocket (wss://) traffic too, so the backend's real-time
# media/telephony endpoints work through this tunnel unchanged.
#
# set the CORS_ORIGIN env var to https://<your-subdomain>.ngrok-free.app so the
# Vercel browser origin checks pass.

param(
  [int]$Port = 3000
)

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  Write-Error "ngrok not found on PATH. Install it: winget install --id ngrok.ngrok"
  exit 1
}

Write-Host "Starting ngrok tunnel -> http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host "Watch the log for an https://<subdomain>.ngrok-free.app URL." -ForegroundColor Cyan
ngrok http "http://127.0.0.1:$Port"