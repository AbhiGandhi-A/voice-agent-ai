var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_meta = {};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var aiClient = null;
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({ apiKey });
  }
  return aiClient;
}
app.get("/api/config", (_req, res) => {
  res.json({
    aiServerHttpUrl: process.env.AI_SERVER_HTTP_URL || process.env.AI_SERVER_HTTP_URL_2 || "",
    aiServerWsUrl: process.env.AI_SERVER_WS_URL || process.env.AI_SERVER_WS_URL_2 || "",
    configured: Boolean(
      process.env.AI_SERVER_HTTP_URL || process.env.AI_SERVER_HTTP_URL_2 || process.env.AI_SERVER_WS_URL || process.env.AI_SERVER_WS_URL_2
    )
  });
});
app.get("/api/health", async (_req, res) => {
  const backendUrl = process.env.AI_SERVER_HTTP_URL || process.env.AI_SERVER_HTTP_URL_2;
  if (backendUrl) {
    try {
      const upstream = await fetch(`${backendUrl.replace(/\/$/, "")}/health`, {
        headers: process.env.AI_SERVER_API_KEY ? { Authorization: `Bearer ${process.env.AI_SERVER_API_KEY}` } : void 0,
        signal: AbortSignal.timeout(5e3)
      });
      const data = await upstream.json().catch(() => ({}));
      return res.status(upstream.ok ? 200 : 503).json({ ...data, status: upstream.ok ? data.status || "ok" : "offline", aiServer: upstream.ok ? "connected" : "offline" });
    } catch {
      return res.status(503).json({ status: "offline", aiServer: "offline" });
    }
  }
  const memory = process.memoryUsage();
  const apiKey = process.env.GEMINI_API_KEY;
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    geminiConfigured: Boolean(apiKey),
    memory: {
      heapUsedMb: (memory.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMb: (memory.heapTotal / 1024 / 1024).toFixed(1),
      rssMb: (memory.rss / 1024 / 1024).toFixed(1)
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/calls", async (req, res) => {
  const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber : "";
  if (!/^\\+[1-9]\\d{7,14}$/.test(phoneNumber)) return res.status(400).json({ error: "A valid international phone number is required" });
  const backendUrl = process.env.AI_SERVER_HTTP_URL || process.env.AI_SERVER_HTTP_URL_2;
  if (!backendUrl) return res.status(503).json({ error: "Telephony service is not configured." });
  try {
    const upstream = await fetch(`${backendUrl.replace(/\/$/, "")}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...process.env.AI_SERVER_API_KEY ? { Authorization: `Bearer ${process.env.AI_SERVER_API_KEY}` } : {} },
      body: JSON.stringify({ phoneNumber }),
      signal: AbortSignal.timeout(1e4)
    });
    const body = await upstream.text();
    res.status(upstream.status).type(upstream.headers.get("content-type") || "application/json").send(body);
  } catch {
    res.status(503).json({ error: "AI backend is unavailable." });
  }
});
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], systemPrompt } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message text is required" });
    }
    const ai = getAI();
    if (!ai) {
      return res.json({
        reply: "I am ready and listening. To activate live Gemini intelligence, please set your GEMINI_API_KEY in the environment settings.",
        source: "local_fallback"
      });
    }
    const contents = [];
    if (Array.isArray(history)) {
      for (const msg of history.slice(-8)) {
        if (msg.role === "user" || msg.role === "assistant") {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content || "" }]
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });
    const defaultSystemPrompt = "You are a friendly, natural, and concise voice AI assistant. Speak directly and conversationally as if talking on the phone. Keep responses clear and typically 1-3 sentences unless the user requests detailed explanations. Always answer the user accurately.";
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt || defaultSystemPrompt,
        temperature: 0.7
      }
    });
    const reply = response.text?.trim() || "I didn't quite catch that. Could you repeat?";
    res.json({
      reply,
      source: "gemini-2.5-flash"
    });
  } catch (err) {
    console.error("Gemini API chat error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error generating AI response";
    res.status(500).json({ error: errorMsg });
  }
});
app.post("/api/summarize", async (req, res) => {
  try {
    const { messages = [], customer = "Caller", duration = "00:00" } = req.body;
    const ai = getAI();
    if (!ai || messages.length === 0) {
      return res.json({
        summary: `Call completed with ${customer}. Total duration: ${duration}.`,
        outcome: "Resolved",
        aiActions: ["Voice call session logged"],
        customerIntent: "General Inquiry",
        followUpRequired: false
      });
    }
    const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const prompt = `Analyze this customer voice call transcript and provide a brief summary in JSON format with fields:
- summary: A concise 1-2 sentence overview of what occurred
- outcome: Exactly one of "Resolved", "Escalated", or "Follow-up Needed"
- customerIntent: A short 2-4 word description of customer intent
- aiActions: An array of 1-3 short strings of actions taken
- followUpRequired: boolean

Transcript:
${transcript}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    try {
      const data = JSON.parse(response.text || "{}");
      res.json({
        customer,
        duration,
        summary: data.summary || `Call completed with ${customer}.`,
        outcome: data.outcome || "Resolved",
        customerIntent: data.customerIntent || "Inquiry",
        aiActions: Array.isArray(data.aiActions) ? data.aiActions : ["Voice session concluded"],
        followUpRequired: Boolean(data.followUpRequired)
      });
    } catch {
      res.json({
        customer,
        duration,
        summary: `Call finished with ${customer}.`,
        outcome: "Resolved",
        customerIntent: "Inquiry",
        aiActions: ["Processed conversation"],
        followUpRequired: false
      });
    }
  } catch (err) {
    console.error("Summarize error:", err);
    res.status(500).json({ error: "Failed to summarize call" });
  }
});
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      // The preview proxy does not expose Vite's internal HMR websocket.
      // Disable the client websocket in middleware mode so it cannot report
      // "WebSocket closed without opened" while the app itself is healthy.
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === "true" ? null : {}
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Voice Agent server listening on http://0.0.0.0:${PORT}`);
  });
}
setupVite().catch((err) => {
  console.error("Failed to start server:", err);
});
//# sourceMappingURL=server.cjs.map
