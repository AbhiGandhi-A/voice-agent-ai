# Deployment Guide — Vercel Frontend → Tunnel → Windows Backend → Ollama

## Architecture

```
                        INTERNET
                           │
                           ▼
              ┌───────────────────────┐
              │  Vercel Frontend      │   static React SPA (only frontend)
              │  vite build:frontend  │   env: VITE_API_BASE_URL, VITE_SUPABASE_*
              └──────────┬────────────┘
                         │  HTTPS  (browser calls VITE_API_BASE_URL, incl. WSS)
                         ▼
              ┌───────────────────────┐
              │ Cloudflare / ngrok    │   public HTTPS tunnel
              │ tunnel                │   forwards wss + https
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │ Windows Node/Express  │   long-running backend, port 3000
              │ backend (tsx server)  │   Supabase JWT auth, CORS allow-list,
              │                       │   /api/* routes, WS media streams
              └──────────┬────────────┘
                         │  http://127.0.0.1:11434  (private, never exposed)
                         ▼
              ┌───────────────────────┐
              │ Ollama :11434         │
              │ llama3.2:3b           │
              └───────────────────────┘
```

Key property: **only the Express backend is public**. Port 11434 is reachable
only from the same Windows machine. The browser talks to Ollama **only through
`/api/ai/chat`** on the backend, which is authenticated and rate-limited.

## 1. Windows backend + Ollama

**One-time:** apply the Supabase schema before first run (see
`SUPABASE_SETUP.md`):

```
npm run db:setup   # needs DATABASE_URL or SUPABASE_DB_PASSWORD in .env
```

Three terminals:

```
# 1) Ollama (already running on 11434)
#    verify: Invoke-RestMethod http://127.0.0.1:11434/api/tags

# 2) Backend (rebuilds frontend, serves :3000)
npm run dev

# 3) Tunnel (Cloudflare quick tunnel OR ngrok)
powershell -ExecutionPolicy Bypass -File scripts\cloudflared-tunnel.ps1
# -or-
powershell -ExecutionPolicy Bypass -File scripts\ngrok-tunnel.ps1
```

Grab the public URL printed (e.g. `https://<sub>.trycloudflare.com` or
`https://<sub>.ngrok-free.app`) and smoke-test it:

```powershell
Invoke-RestMethod https://<sub>.trycloudflare.com/api/health | ConvertTo-Json
Invoke-RestMethod https://<sub>.trycloudflare.com/api/ai/chat `
  -Method POST -ContentType 'application/json' `
  -Body '{"message":"Say hello in one short sentence."}' | ConvertTo-Json
```

> Every quick tunnel URL is random and non-persistent — **development/test
> infrastructure only**. For a stable URL use a Cloudflare named tunnel
> (`cloudflared tunnel create` + `cloudflared tunnel route dns`) or a pinned
> ngrok domain.

## 2. CORS allow-list

Server reads `CORS_ORIGIN` (comma-separated). Wildcards are supported for
subdomains: `https://*.vercel.app`, `https://*.ngrok-free.app`,
`https://*.trycloudflare.com`. No `*`, ever, in production.

Local defaults in `.env`:

```
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173
```

To allow the Vercel frontend (add and restart backend):

```
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://your-app.vercel.app
```

Browser-less requests (curl, telephony webhooks, WebSocket clients without an
Origin header) are always allowed — CORS only restricts browsers.

## 3. Vercel frontend

`vercel.json` already pins the framework/build:

- Framework: `vite`
- Build: `npm run build:frontend` (client only — the Express server binaries
  are **not** uploaded to Vercel)
- Output directory: `dist/client`
- SPA fallback: all non-asset routes rewrite to `index.html`

Set these Vercel **Environment Variables** (Project → Settings → Env Vars,
Production + Preview):

| Env var | Value | Public? |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://<your-backend-tunnel-url>` | yes (browser) — set at build |
| `VITE_SUPABASE_URL` | Supabase project URL | yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | yes |
| `VITE_AUTH_REDIRECT_URL` | `https://<your-app>.vercel.app` | yes |
| `CORS_ORIGIN` | `https://<your-app>.vercel.app` (+ tunnel URL) | server-side on your PC |

**Never** set `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`,
`TELEPHONY_AUTH_TOKEN`, `TELEPHONY_WEBHOOK_SECRET`, or `OLLAMA_*` on Vercel —
those live server-side only. VITE_* values are public by design (anon keys are
safe; service-role keys are not).

## 4. End-to-end flows that work after this setup

```
AI chat:   Vercel browser → VITE_API_BASE_URL/api/ai/chat → tunnel → Express
           → Supabase JWT check → Ollama 127.0.0.1:11434 → llama3.2:3b → reply
Auth:      browser → Supabase (VITE_SUPABASE_URL) → session → Bearer token →
           /api/auth/me (server verifies JWT)
Web voice: browser STT/TTS (Web Speech API) → /api/ai/chat → Ollama (no audio
           flows to the server; see VoiceHeroCard)
```

## 5. Truthful health reporting

`GET /api/health` reports real probe results, never fake "online":

```json
{
  "status": "ok",
  "database":   { "connected": true,  "provider": "supabase" },
  "ai":         { "available": true,  "provider": "ollama", "status": "online",
                  "baseUrl": "http://127.0.0.1:11434", "model": "llama3.2:3b" },
  "stt":        { "provider": "browser", "status": "connected", ... },
  "tts":        { "provider": "browser", "status": "connected", ... },
  "telephony":  { "configured": false, "details": "No telephony provider configured..." }
}
```

If Ollama is down, `ai.status` is `"offline"`, `available` is `false`, and
`/api/ai/*` return truthful `503` errors (no fake replies).

## 6. Render (optional long-term backend hosting)

A quick tunnel from a personal PC is **not** production hosting. Long-term:

- Host the Express backend on Render (or any Node host) with WebSockets enabled.
  The repo builds a single `dist/server.js` (`npm run build`; start = `npm start`).
- Ollama must be reachable from wherever the backend runs. If the LLM stays on
  your Windows PC, the backend needs its own tunnel/route back to 11434 — a
  public cloud host cannot reach `127.0.0.1` on your PC. Real production

  means hosting the backend **and** the LLM/inference together (or using a
  hosted model endpoint).

Until then, the Windows + tunnel setup is the working development/staging
architecture.

## 7. Security checklist

- [ ] `OLLAMA_BASE_URL` only references `127.0.0.1`/LAN — port 11434 has no
      public tunnel, no firewall rule, no Vercel env var.
- [ ] `.env` is gitignored; `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`,
      `TELEPHONY_*` are server-side only and never in VITE_*.
- [ ] Backend `/api/*` retains Supabase JWT auth, rate limiting, Zod
      validation, and the existing error handler (nothing removed).
- [ ] CORS uses an explicit allow-list (`CORS_ORIGIN`), no `*`, credentials on.
- [ ] `/api/telephony/media` WebSocket upgrades preserved; telephony auth is
      validated server-side via `TELEPHONY_WEBHOOK_SECRET`.
- [ ] `npm run dev` / `npm start` still shut down gracefully (SIGINT/SIGTERM).
- [ ] Browser never calls Ollama directly — only `/api/ai/chat`.