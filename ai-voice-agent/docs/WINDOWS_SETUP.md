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
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local LLM (default `http://127.0.0.1:11434`) | For chat/summaries |
| `TELEPHONY_*` | Twilio or Telnyx credentials | For real calls only |
| `STT_PROVIDER`, `TTS_PROVIDER` | `browser` (default) | Usually leave default |

## 4. Run

```powershell
# Dev (two shells): API on :3000, Vite on :5173 proxying /api to :3000
npm run dev
npm run dev -- --host   # optional: Vite dev server

# Production
npm run build
npm start
```

Open `http://localhost:3000` (production) or the Vite URL (dev). Without
Supabase credentials the app opens an auth screen explaining what is missing;
with credentials, sign in with an account you create in the Supabase UI.

## 5. Verify

```powershell
# Server health — must report truthful states (no fake "online")
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json

# Diagnostics script — checks Supabase, Ollama, and telephony configuration
npm run db:diag
```

## 6. Quality gates

```powershell
npm run typecheck    # tsc --noEmit
npm test             # vitest (42 unit tests)
npm run build
```

## 7. Troubleshooting

- **Build says nothing / server exits silently on Windows:** the server entry
  uses an ESM-aware `isMain` check that requires the `file:///` URL prefix;
  always start with `npm run dev` / `npm start` (script `tsx`/`node` handle it).
- **`/api/health` shows `database.connected: false`:** `.env` lacks the Supabase
  variables — see `SUPABASE_SETUP.md`.
- **Vite dev → API 404s:** the dev server proxies `/api` to `127.0.0.1:3000`;
  make sure the API is running first.

## Known limits (no live credentials in this repo)

- No Supabase/Ollama/telephony credentials are committed; live end-to-end calls
  are impossible until you add them. The app truthfully shows "not configured"
  states instead.
- G.711 audio codecs were implemented as a self-consistent pair; validate
  byte-level behavior against a live provider's reference audio before
  production telephony traffic.