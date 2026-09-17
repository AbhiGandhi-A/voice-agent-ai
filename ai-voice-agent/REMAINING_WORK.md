# Remaining Work

## COMPLETED
- Removed browser-persisted mock call, contact, conversation, and service data from runtime initialization.
- Dialer now validates international numbers and calls the server proxy instead of creating a local connected call.
- Added a server-side `/api/calls` proxy with truthful unavailable/error responses.
- Health checks use `AI_SERVER_HTTP_URL`/`AI_SERVER_HTTP_URL_2` when configured and report offline when unreachable.
- Existing UI structure and styling were preserved.

## PARTIALLY COMPLETED
- The dashboard state is currently session-local for data returned by APIs; list/detail CRUD endpoints still need to be connected to the external backend.
- Existing chat and summary routes need to be migrated fully to the external AI server contract.

## REQUIRES AI SERVER
- `/health`, `/calls`, `/ws/voice`, transcript events, model status, settings, recordings, summaries, and call controls must be implemented by the external server.
- Configure `AI_SERVER_HTTP_URL`, `AI_SERVER_WS_URL`, and the matching private API key variables in the deployment environment.

## REQUIRES ASTERISK
- Real outbound/inbound call routing, RTP audio, recording, transfer, hold, and mute.

## REQUIRES SIP
- A legitimate SIP/business voice provider and PJSIP credentials.

## REQUIRES JIO
- A normal Jio SIM cannot be controlled directly by this web dashboard. Jio telephony requires an approved external telephony/SIP/business voice setup.

## REQUIRES DATABASE
- Durable calls, conversations, contacts, settings, and recordings require the backend/database layer; no browser storage is used as a substitute.

## REQUIRES EXTERNAL CREDENTIALS
- Production AI backend URL, WebSocket URL, API key, telephony/SIP credentials, and any backend database credentials.

## NOT IMPLEMENTED
- No fake telephony, fake transcripts, fake recordings, or fake connection success was added.
- Vercel deployment was not performed from this environment.

## Validation
- `npm run lint` passed.
- `npm run build` passed with the existing esbuild `import.meta` CommonJS warning.
- The warning should be addressed separately if the server is expected to resolve its module directory via `import.meta.url` in the bundled CommonJS artifact.
