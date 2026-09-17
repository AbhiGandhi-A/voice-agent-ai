import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// 1. Health & Real Diagnostics Endpoint
app.get('/api/config', (_req, res) => {
  res.json({
    aiServerHttpUrl: process.env.AI_SERVER_HTTP_URL || process.env.AI_SERVER_HTTP_URL_2 || '',
    aiServerWsUrl: process.env.AI_SERVER_WS_URL || process.env.AI_SERVER_WS_URL_2 || '',
    configured: Boolean(
      process.env.AI_SERVER_HTTP_URL ||
        process.env.AI_SERVER_HTTP_URL_2 ||
        process.env.AI_SERVER_WS_URL ||
        process.env.AI_SERVER_WS_URL_2
    ),
  });
});

app.get('/api/health', (req, res) => {
  const memory = process.memoryUsage();
  const apiKey = process.env.GEMINI_API_KEY;
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    geminiConfigured: Boolean(apiKey),
    memory: {
      heapUsedMb: (memory.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMb: (memory.heapTotal / 1024 / 1024).toFixed(1),
      rssMb: (memory.rss / 1024 / 1024).toFixed(1),
    },
    timestamp: new Date().toISOString(),
  });
});

// 2. Real AI Chat & Voice Reply Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], systemPrompt } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const ai = getAI();
    if (!ai) {
      // Graceful conversational response if API key is not yet set
      return res.json({
        reply: "I am ready and listening. To activate live Gemini intelligence, please set your GEMINI_API_KEY in the environment settings.",
        source: 'local_fallback',
      });
    }

    // Prepare contents array with history
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add prior conversation messages
    if (Array.isArray(history)) {
      for (const msg of history.slice(-8)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content || '' }],
          });
        }
      }
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const defaultSystemPrompt =
      'You are a friendly, natural, and concise voice AI assistant. Speak directly and conversationally as if talking on the phone. Keep responses clear and typically 1-3 sentences unless the user requests detailed explanations. Always answer the user accurately.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt || defaultSystemPrompt,
        temperature: 0.7,
      },
    });

    const reply = response.text?.trim() || "I didn't quite catch that. Could you repeat?";

    res.json({
      reply,
      source: 'gemini-2.5-flash',
    });
  } catch (err: unknown) {
    console.error('Gemini API chat error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Error generating AI response';
    res.status(500).json({ error: errorMsg });
  }
});

// 3. Real Call Summary Generation Endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    const { messages = [], customer = 'Caller', duration = '00:00' } = req.body;

    const ai = getAI();
    if (!ai || messages.length === 0) {
      return res.json({
        summary: `Call completed with ${customer}. Total duration: ${duration}.`,
        outcome: 'Resolved',
        aiActions: ['Voice call session logged'],
        customerIntent: 'General Inquiry',
        followUpRequired: false,
      });
    }

    const transcript = messages
      .map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `Analyze this customer voice call transcript and provide a brief summary in JSON format with fields:
- summary: A concise 1-2 sentence overview of what occurred
- outcome: Exactly one of "Resolved", "Escalated", or "Follow-up Needed"
- customerIntent: A short 2-4 word description of customer intent
- aiActions: An array of 1-3 short strings of actions taken
- followUpRequired: boolean

Transcript:
${transcript}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    try {
      const data = JSON.parse(response.text || '{}');
      res.json({
        customer,
        duration,
        summary: data.summary || `Call completed with ${customer}.`,
        outcome: data.outcome || 'Resolved',
        customerIntent: data.customerIntent || 'Inquiry',
        aiActions: Array.isArray(data.aiActions) ? data.aiActions : ['Voice session concluded'],
        followUpRequired: Boolean(data.followUpRequired),
      });
    } catch {
      res.json({
        customer,
        duration,
        summary: `Call finished with ${customer}.`,
        outcome: 'Resolved',
        customerIntent: 'Inquiry',
        aiActions: ['Processed conversation'],
        followUpRequired: false,
      });
    }
  } catch (err: unknown) {
    console.error('Summarize error:', err);
    res.status(500).json({ error: 'Failed to summarize call' });
  }
});

// Vite middleware / static serving
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      // The preview proxy does not expose Vite's internal HMR websocket.
      // Disable the client websocket in middleware mode so it cannot report
      // "WebSocket closed without opened" while the app itself is healthy.
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Voice Agent server listening on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Failed to start server:', err);
});
