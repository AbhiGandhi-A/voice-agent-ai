# Windows Local Setup Guide

Run the full AI voice call center locally on Windows (PowerShell). Everything
runs on your machine — no cloud LLM accounts required. The UI is unchanged;
this stack replaces the old mock layer with real services.

## 1. Prerequisites

- Node.js **20+** (developed on Node 24) and npm.
- [Ollama](https://ollama.dev) installed and running on `http://127.0.0.1:11434`.

## 2. Install and build

```powershell
npm install
npm run build        # Vite → dist/client, esbuild → dist/server.js
```

## 3. Environment variables

Copy the template and fill it in — nothing is required for a basic smoke test:

```powershell
Copy-Item .env.example .env
```

| Variable | Purpose | Required? |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Postgres persistence + auth (see `SUPABASE_SETUP.md`) | Yes for full features |
| `DATABASE_URL` **or** `SUPABASE_DB_PASSWORD` | Direct Postgres connection for `npm run db:setup` (applies the schema) | Before first `db:setup` |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local LLM (default `http://127.0.0.1:11434`) | For chat/summaries |
| `TELEPHONY_*` | Twilio or Telnyx credentials | For real calls only |
| `STT_PROVIDER`, `TTS_PROVIDER` | `browser` (default) | Usually leave default |

## 4. Apply the Supabase schema (one-time)

```powershell
npm run db:setup   # applies supabase/migrations/0001_init.sql via Postgres
```

Skips on re-run when the migration checksum already matches. Needs `DATABASE_URL`
or `SUPABASE_DB_PASSWORD` in `.env`. See `SUPABASE_SETUP.md` for details.

## 5. Run

```powershell
# Dev: rebuilds the frontend (fresh VITE_* env), then starts the API + SPA on :3000
npm run dev

# Production
npm run build
npm start
```

Open `http://localhost:3000`. Without Supabase credentials the app opens an
auth screen explaining what is missing; with credentials, sign in with an
account you create in the Supabase UI.

## 6. Verify

```powershell
# Server health — must report truthful states (no fake "online")
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json

# Diagnostics script — checks Supabase, Ollama, and telephony configuration
npm run db:diag
```

## 7. Quality gates

```powershell
npm run typecheck    # tsc --noEmit
npm test             # vitest (42 unit tests)
npm run build
```

## 8. Troubleshooting

- **Build says nothing / server exits silently on Windows:** the server entry
  uses an ESM-aware `isMain` check that requires the `file:///` URL prefix;
  always start with `npm run dev` / `npm start` (script `tsx`/`node` handle it).
- **`/api/health` shows `database.connected: false`:** `.env` lacks the Supabase
  variables, or the schema migration hasn't been applied yet — run
  `npm run db:setup` (see `SUPABASE_SETUP.md`).
- **Stale UI after editing `VITE_*` vars:** `npm run dev` rebuilds the frontend
  on start, so just restart it (a plain `npm start` reuses old assets).

## 9. Expose the backend publicly (tunnel)

The backend is a long-running Node server with WebSockets, so it stays on your
Windows PC. To let the Vercel-hosted frontend reach it, run a public tunnel that
forwards **HTTPS → http://127.0.0.1:3000**. Ollama (11434) is never tunneled.

See the [architecture diagram and full deployment guide](DEPLOYMENT.md).

```powershell
# Terminal 1 — Ollama (must already be serving)
# start the "Ollama" app or:  ollama serve
# Verify:  Invoke-RestMethod http://127.0.0.1:11434/api/tags

# Terminal 2 — backend (rebuilds frontend, then serves :3000)
npm run dev

# Terminal 3a — Cloudflare quick tunnel (no account; random URL)
powershell -ExecutionPolicy Bypass -File scripts\cloudflared-tunnel.ps1
# Copy the printed https://<sub>.trycloudflare.com URL.

# Terminal 3b — ngrok (alternate; requires authtoken)
powershell -ExecutionPolicy Bypass -File scripts\ngrok-tunnel.ps1
# Copy the printed https://<sub>.ngrok-free.app URL.
```

Both cloudflared and ngrok proxy **WebSocket (wss://)** traffic, so the real-time
media/telephony endpoints work through the tunnel unchanged.

> IMPORTANT: a quick tunnel URL changes on every restart and is **development /
> testing infrastructure**, not production hosting. Use a Cloudflare named
> tunnel (`cloudflared tunnel create/route/run`) or a pinned ngrok domain for a
> stable URL.

## 10. Vercel deployment (frontend only)

The frontend deploys to Vercel as a **static build** (`vercel.json` + the
`build:frontend` script). The Express backend stays on your PC behind the tunnel.

1. Push this repo to GitHub, then **New Project → Import** the repo (Root =
   `ai-voice-agent`). `vercel.json` sets the build/output for you.
2. Project → Settings → **Environment Variables** — set all **PRODUCTION**
   values from `.env.example` (see `DEPLOYMENT.md` for the full list):
   - `VITE_API_BASE_URL=https://<your-tunnel-url>` (public backend URL)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_AUTH_REDIRECT_URL=https://<your-vercel-domain>.vercel.app`
3. On your server's `.env`, add the Vercel origin to `CORS_ORIGIN`:
   `... ,https://<your-vercel-domain>.vercel.app` (and the tunnel URL if the
   browser ever calls it directly), then restart `npm run dev`.
4. Deploy. The SPA calls `VITE_API_BASE_URL`, so every `/api/*` request and the
   WebSocket connection route through the tunnel to your Windows backend.

Details, the exact env-var table, and an architecture diagram: `DEPLOYMENT.md`.

## Known limits (no live credentials in this repo)

- No Supabase/Ollama/telephony credentials are committed; live end-to-end calls
  are impossible until you add them. The app truthfully shows "not configured"
  states instead.
- G.711 audio codecs were implemented as a self-consistent pair; validate
  byte-level behavior against a live provider's reference audio before
  production telephony traffic.