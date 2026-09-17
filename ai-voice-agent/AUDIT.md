# Existing Project Audit

## Scope

This audit was performed before changing runtime behavior or UI. The existing visual implementation was not modified.

## Project and runtime

- React 19 + TypeScript + Vite 6 + Tailwind CSS 4 frontend.
- Express server in `server.ts`, started by `npm run dev` through `tsx`.
- Production build creates a Vite `dist` directory and bundles the Express server with esbuild.
- The repository contains `pnpm-lock.yaml`; the package manifest has no `packageManager` field. The lockfile indicates pnpm is the repository's existing package-manager convention.
- `npm run lint` is currently a TypeScript no-emit check. There are no `typecheck` or `test` scripts.
- No Vercel configuration file, Vercel adapter, deployment URL, or Vercel-specific API route structure was found.

## 1. Already implemented

### UI and navigation

- A complete dashboard UI exists with Home, Conversations, Calls, Dialer, Live Call, Contacts, Settings, Models, Integrations, System Status, and Help views.
- The visual design is implemented in the existing React components and `src/index.css`.
- Empty conversation, call, and contact collections render existing empty-state UI.
- The frontend has microphone, waveform, transcript, settings, call-control, and diagnostics components.

### Browser voice capabilities

- `VoiceSessionManager` requests microphone access with `getUserMedia`.
- Web Audio analyser code exists for amplitude visualization.
- Browser Web Speech Recognition is used as client-side STT when available.
- Browser Speech Synthesis is used as client-side TTS when available.
- Session cleanup attempts to stop recognition, audio tracks, audio context, animation frames, timers, and WebSocket connections.

### Local application wiring

- React state is wired across the existing views.
- A client-side `VoiceSessionManager` abstraction exists with start/stop session, mute, interruption, speech completion, and text playback methods.
- Express exposes `/api/health`, `/api/chat`, and `/api/summarize`.
- A basic browser-to-server WebSocket client path exists in `src/lib/voice-session.ts`.

## 2. Partially implemented

- Health checking calls the local Express `/api/health`, but it checks only the dashboard server and not the required external AI backend health contract.
- WebSocket support exists, but it only sends a `session_started` message and reacts to `ai_text`; the required event protocol is not implemented.
- Microphone access is real, but permission/device failure is swallowed and the session continues as if listening were available.
- Browser STT produces transcript events, but it is not Whisper and does not send audio to the external AI server.
- Browser TTS produces speech, but it is not Piper and does not consume backend audio.
- Chat requests use local `/api/chat` and a Gemini integration rather than the required external AI server/Ollama pipeline.
- Dialer and live call screens exist, but the current call flow is local state creation, not a real call API or Asterisk call.
- Call summaries call `/api/summarize`, but fallback summaries are generated without backend confirmation.
- System status has browser capability checks and local process health, but service statuses are not backed by Ollama, Whisper, Piper, Asterisk, SIP, database, or WebSocket checks.
- Settings are persisted locally and passed into the browser voice manager, but are not read from or saved to a real backend configuration service.
- Live-call timer starts when the component mounts, not when a backend `call_connected` event arrives.

## 3. Mocked, simulated, or locally fabricated runtime data

- `src/lib/mock-data.ts` contains `INITIAL_SERVICES` entries that claim Gemini, browser STT/TTS, local storage, and the Voice Agent HTTP Backend are online before verification.
- `src/lib/storage.ts` uses `localStorage` for conversations, calls, contacts, settings, and system configuration. This is client-only persistence, not production backend storage.
- `DEFAULT_SYSTEM_CONFIG` hardcodes `/api`, `/ws/voice`, wildcard allowed origins, and a disabled mock flag instead of loading the required environment-backed server configuration.
- `DialerView` initializes the phone field to a hardcoded `+91 98765 43210` value.
- `App.tsx` creates a synthetic contact when dialing an unknown number and immediately creates a synthetic connected call with a synthetic greeting.
- `App.tsx` uses browser Speech Synthesis for the synthetic call greeting.
- `App.tsx` uses hardcoded call metadata, status, timestamps, duration, and AI status for local call creation.
- `App.tsx` generates local message IDs and local conversation/call records instead of receiving persisted records from a backend.
- `App.tsx` creates fallback call summaries when summarization fails or no real transcript exists.
- `VoiceSessionManager` continues after microphone failure, has a timer-based speech fallback when Speech Synthesis is unavailable, and generates an offline fallback reply when `/api/chat` fails. These behaviors can make an unavailable backend appear functional.
- `LiveCallView` starts a synthetic one-second timer on mount, defaults recording to active, and renders a hardcoded waveform sequence.
- `LiveCallView` toggles mute, hold, recording, and human takeover entirely in local component state without backend actions.
- `SystemStatusView` displays `Connecting...`, `Active Runtime`, browser fallback labels, and locally seeded service status values that do not prove the underlying services are healthy.
- Multiple UI strings describe Asterisk SIP, Gemini, Ollama, or telephony readiness even though no corresponding production connection is present.

## 4. Missing

- External `AI_SERVER_HTTP_URL`, `AI_SERVER_WS_URL`, and `AI_SERVER_API_KEY` integration.
- Server-side secure proxy for HTTP calls requiring the private AI server API key.
- Production external AI backend health adapter for the actual `/health` response shape.
- Required WebSocket event handling for session, call, transcript, AI state, tool, recording, takeover, return-to-AI, and error events.
- Audio transport from the browser to the external WebSocket/backend.
- Real `POST /calls` dialing flow and backend call ID lifecycle.
- Real call retrieval, call history, conversations, contacts, recordings, model information, and settings APIs.
- Backend actions for mute, hold, takeover, return-to-AI, transfer, recording, and end call.
- Backend-controlled call timestamps, duration, state transitions, and transcript persistence.
- Real recording URLs and playback integration.
- Real service checks for AI server, Ollama, Whisper, Piper, Asterisk, SIP, database, and WebSocket.
- Production-safe CORS origin configuration and WSS enforcement/documentation.
- Inbound calls, RTP audio bridge, SIP/PJSIP integration, and telephony provider integration.
- Database-backed persistence and authentication/authorization strategy.
- Vercel deployment configuration and verified deployment URL.
- Automated tests and a test script.

## 5. Broken or unsafe for the requested production architecture

- The app currently depends on Gemini (`GEMINI_API_KEY`) in `server.ts`, contrary to the requested external Whisper/Ollama/Piper AI server architecture.
- `/api/chat` returns a fabricated success response when `GEMINI_API_KEY` is absent.
- `/api/summarize` returns a fabricated successful summary when the AI client is absent or messages are empty.
- The frontend reports connection success when the local `/api/health` endpoint responds, not when the real AI backend is healthy.
- The frontend sends the full client-side voice configuration over WebSocket and has no API-key authentication protocol.
- `systemConfig.apiKey` is client-persisted and would be unsafe if used for a private credential.
- Wildcard `allowedOrigins: '*'` is unsuitable for production.
- The WebSocket URL is a relative `/ws/voice` default, but the Express server does not implement a WebSocket server or `/ws/voice` upgrade handler.
- `LiveCallView` shows an active/connected call view immediately after local call creation, before any backend confirmation.
- Live call controls do not call a real backend and therefore can claim state changes that did not happen.
- The `setTimeout` fallback and offline reply violate the real-data-only requirement.
- Runtime data is stored in `localStorage`, which is explicitly disallowed for production persistence under the requested architecture.
- Some TypeScript types do not cover the full required call state/event model.

## 6. Required for production

1. Confirm the external AI backend HTTP and WSS API contracts, including authentication headers, event envelopes, audio encoding, and action messages.
2. Load private backend configuration from server-side environment variables; never expose `AI_SERVER_API_KEY` to browser code.
3. Add secure lightweight server routes for HTTP backend operations and use the external WSS endpoint directly from the browser only with an approved authentication design.
4. Replace local mock/fallback success paths with explicit not-configured, offline, rejected, timeout, and error states using the existing UI states.
5. Replace local storage with a real persistence API/database or the authoritative backend APIs.
6. Implement real call creation, call lifecycle, transcript, recording, history, contacts, models, settings, and control operations.
7. Implement and validate all required WebSocket events and cleanup behavior.
8. Add real backend health mapping for AI server, Ollama, Whisper, Piper, Asterisk, SIP, database, and WebSocket.
9. Configure production CORS to allow the exact deployed Vercel origin; use WSS in production.
10. Add production build/type/lint/test validation and deploy only after the backend contract is available.
11. Configure Asterisk/SIP/PJSIP, RTP audio bridging, telephony provider/business voice connectivity, and recording storage outside Vercel.
12. Treat a normal Jio SIM as unavailable to browser/Asterisk control; it requires a supported telephony/SIP/business voice connection and credentials.

## Phone-call capability checklist

- [ ] Real outbound calls — local synthetic call only
- [ ] Real inbound calls — not found
- [ ] Asterisk — UI text only; no integration
- [ ] SIP — UI text only; no integration
- [ ] PJSIP — not found
- [ ] RTP audio — not found
- [ ] AI audio bridge — not found
- [ ] Whisper integration — not found; browser Speech Recognition is used
- [ ] Ollama integration — not found
- [ ] Piper integration — not found; browser Speech Synthesis is used
- [ ] Live transcript — browser-local transcript only, not backend transcript events
- [ ] Live call status — local synthetic status only
- [ ] Call recording — local UI toggle only
- [ ] Call summary — local fallback or Gemini endpoint, not authoritative call backend
- [ ] Human takeover — local UI toggle only
- [ ] Return to AI — local UI toggle only
- [ ] Hold — local UI toggle only
- [ ] Mute — browser/local state only
- [ ] Transfer — not implemented
- [ ] Call history — localStorage only
- [ ] Contacts — localStorage only
- [ ] Jio integration — not implemented; requires telephony/SIP configuration

## Environment and deployment findings

- The requested environment variable names are not referenced by the application code.
- The current server expects `GEMINI_API_KEY`, which is not part of the requested architecture.
- No `.env.example` was found in the repository despite the README referring to one.
- No Vercel deployment URL or deployment configuration was found.
- The project is a Vite/Express app rather than a Next.js app; Vercel deployment needs an explicit server/API architecture decision before production deployment.

## Audit conclusion

The visual UI is substantially implemented and should be preserved exactly. The current runtime is a local/demo-oriented prototype: it contains browser-local persistence, synthetic call creation, fallback AI responses, seeded online statuses, and local-only call controls. The next implementation phase should remove those success/fallback paths and connect the existing components to the real external backend contract without changing their appearance.

## Audit limitations

This document records repository evidence available before implementation. A final `REMAINING_WORK.md` must be generated after the real backend integration and validation work, with each item reclassified based on verified behavior rather than intended behavior.

## UI preservation baseline

- Existing sidebar, navigation, page structure, cards, colors, typography, spacing, buttons, icons, microphone, waveform, transcript, right sidebar, animations, and responsive classes were not edited during this audit.
- No visual redesign or replacement dashboard was introduced.

## Verification status at audit start

- Build: not run yet.
- Lint/type check: not run yet.
- Tests: no test script exists.
- Browser route verification: not run yet.
- Vercel deployment: not performed.
- Real backend connection: not configured/verified.

## Exact next step for real phone calls

Provide the external AI backend HTTP/WSS contract and configure a supported telephony/SIP/business voice connection to Asterisk (not a normal Jio SIM alone). Then implement authenticated call creation and event/audio bridging against that contract; until verified, the UI must show the existing not-configured/offline state rather than a connected call.

## Current status

- Existing UI preserved: YES
- Mock/demo runtime data removed: NO (audit only; removal is the next implementation phase)
- Production build: NOT RUN
- Vercel deployment: NOT PERFORMED
- Real backend connection: NOT CONFIGURED / NOT VERIFIED
- Jio: REQUIRES TELEPHONY/SIP CONFIGURATION

## Runtime files requiring the next phase

- `src/App.tsx`
- `src/lib/mock-data.ts`
- `src/lib/storage.ts`
- `src/lib/voice-session.ts`
- `src/types/index.ts`
- `src/components/DialerView.tsx`
- `src/components/LiveCallView.tsx`
- `src/components/SystemStatusView.tsx`
- `server.ts`
- `package.json`
- deployment/environment configuration

No UI styling files were changed for this audit.

## Required user/backend clarification before production wiring

The repository does not specify the exact external backend API beyond the example health shape and event names in the request. Production integration requires the actual HTTP paths, request/response schemas, WebSocket authentication method, audio codec/framing, call-control message schemas, and persistence ownership. Without those contracts, code should not invent endpoints or claim real connectivity.

## Follow-up report

`REMAINING_WORK.md` is intentionally not created during the audit-only phase. It should be created after implementation and validation so its categories reflect verified completion.

## UI audit note

The existing UI includes copy that claims readiness (for example, telephony bridge and online service labels). Those are runtime truthfulness issues to correct behind the existing UI in the implementation phase; this audit did not alter them so the approved UI remains unchanged during inspection.

## Security note

The current client-side settings model includes an API-key field. Any production implementation must prevent private credentials from being persisted or exposed in browser state and must keep backend credentials server-side.

## Testing note

The requested commands `npm run typecheck` and `npm test` are unavailable in the current package manifest. The available validation command is `npm run lint`; package-manager consistency requires using the existing pnpm lockfile/convention unless the project owner explicitly changes it.

## Summary

The repository is a functional visual prototype, not yet a real AI phone system. The UI can be preserved, but almost every backend-dependent capability in the requested architecture remains missing or locally simulated.
