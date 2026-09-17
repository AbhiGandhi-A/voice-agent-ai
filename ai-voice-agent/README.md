# voice-agent-ai

An open-source, full-stack AI Voice Agent application built with React, TypeScript, Vite, Tailwind CSS, Express, and Google Gen AI (Gemini 2.5). Features real-time voice streaming with speech recognition (STT), hardware-accelerated speech synthesis (TTS), live audio waveform analysis, call dialing & management, supervisor human takeover, conversation history, and contact directories.

## Features

- **Real-Time Voice Sessions**: Live microphone input with Web Speech API STT and Web Audio analyzer.
- **Server-Side AI Pipeline**: Express backend routing conversational inference to Google Gen AI (`gemini-2.5-flash`).
- **Neural Speech Synthesis**: Natural client-side audio response generation.
- **Telephony & Dialer**: Outbound call simulator, live call supervision, human takeover controls, and automatic call summarization.
- **Data Persistence**: Local persistence for conversations, call logs, contacts, and configuration.
- **System Diagnostics**: Live health checking for server status, heap memory usage, and audio capabilities.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Add your Gemini API key:

```env
GEMINI_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
```

The application runs on `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

## License

MIT
