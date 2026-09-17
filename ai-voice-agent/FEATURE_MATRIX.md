# Feature Matrix

| Feature | Implemented | Tested | Real/Fake | Notes |
|---|---:|---:|---|---|
| Existing dashboard UI | Yes | Yes | Real UI | Preserved; no redesign |
| Navigation | Yes | Partial | Real | Existing client tabs |
| Dialer validation | Yes | Yes | Real | E.164 validation |
| Call initiation | Partial | Yes | Real | Server proxy; requires AI server |
| Health status | Partial | Yes | Real | External `/health` when configured |
| WebSocket | Partial | No | Real | Requires external `/ws/voice` contract |
| Live transcript | Partial | No | Real | Requires backend events |
| AI response | Partial | No | Real | Requires configured AI backend |
| Microphone / voice detection | Existing | No | Real | Browser capability only |
| Ollama / Whisper / Piper | No | No | External | Must run on AI server |
| Asterisk / SIP / Jio | No | No | External | Requires telephony configuration |
| Call history | Partial | No | Real | Requires backend persistence |
| Conversations | Partial | No | Real | Requires backend persistence |
| Contacts | Partial | No | Real | Requires backend persistence |
| Settings | Partial | No | Real | Requires backend persistence |
| Models / system status | Partial | No | Real | Requires backend status endpoints |
| Recordings / summaries | Partial | No | Real | Requires backend implementation |
| Authentication / database | No | No | External | Not present in this frontend repository |
| Production build | Yes | Yes | Real | `npm run lint`, `npm run build` pass |
| Vercel deployment | No | No | N/A | Not deployed from this turn |
