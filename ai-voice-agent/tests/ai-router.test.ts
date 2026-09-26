import { describe, expect, it, vi } from 'vitest';
import { routeAiRequest } from '../server/services/ai/ai-router';
import { mapMessage } from '../src/lib/mappers';
import { buildVisionContextForPrompt } from '../server/services/ai/chat.service';

const input = (message: string, language = 'en') => ({
  message,
  language,
  systemPrompt: 'You are concise.',
  history: [],
});

describe('AI provider router', () => {
  it('uses Groq for normal tasks only', async () => {
    const groq = { generate: vi.fn().mockResolvedValue({ text: 'Hooks explained.', model: 'groq-model', latencyMs: 12 }) };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };

    const result = await routeAiRequest(input('Explain React hooks.'), { groq, search, ollama });

    expect(result.source).toBe('groq');
    expect(groq.generate).toHaveBeenCalledOnce();
    expect(search).not.toHaveBeenCalled();
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('uses real search results as Ollama input for search tasks', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn().mockResolvedValue([{ title: 'React', url: 'https://react.dev', snippet: 'Current docs', source: 'Docs' }]);
    const ollama = { generate: vi.fn().mockResolvedValue({ text: 'React summary.', model: 'llama3.2:3b', latencyMs: 25 }) };

    const result = await routeAiRequest(input('Find the latest React version.'), { groq, search, ollama });

    expect(result.source).toBe('search_ollama');
    expect(search).toHaveBeenCalledOnce();
    expect(ollama.generate).toHaveBeenCalledOnce();
    expect(ollama.generate.mock.calls[0][0][0].content).toContain('https://react.dev');
    expect(groq.generate).not.toHaveBeenCalled();
  });

  it('uses the runtime clock without calling an AI provider', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };

    const result = await routeAiRequest({ ...input("What is today's date?"), runtimeContext: { currentTime: '2026-09-19T09:00:00.000Z', timezone: 'Asia/Kolkata' } }, { groq, search, ollama });

    expect(result.source).toBe('current_time');
    expect(result.text).toContain('September 19, 2026');
    expect(groq.generate).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('routes Hindi date questions to the runtime clock', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };

    const result = await routeAiRequest({ ...input('आज कौन सा दिन है?', 'hi'), runtimeContext: { currentTime: '2026-09-19T09:00:00.000Z', timezone: 'Asia/Kolkata' } }, { groq, search, ollama });

    expect(result.source).toBe('current_time');
    expect(groq.generate).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('keeps search analysis in the active language', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn().mockResolvedValue([{ title: 'AI News', url: 'https://example.com/news', snippet: 'News result', source: 'Example' }]);
    const ollama = { generate: vi.fn().mockResolvedValue({ text: 'समाचार का सारांश।', model: 'llama3.2:3b', latencyMs: 25 }) };

    await routeAiRequest(input("Find today's AI news and explain it in Hindi.", 'hi'), { groq, search, ollama });

    expect(ollama.generate.mock.calls[0][0][0].content).toContain('ACTIVE RESPONSE LANGUAGE: Hindi');
    expect(ollama.generate.mock.calls[0][0][0].content).toContain('https://example.com/news');
  });

  it('routes "Can you see me?" to vision and returns camera-off message when camera is inactive', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({ cameraActive: false, faceDetected: false, expression: 'none', confidence: 0, serviceAvailable: true }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('Can you see me?'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('camera is currently turned off');
    expect(groq.generate).not.toHaveBeenCalled();
  });

  it('routes facial expression questions and returns detected expression with confidence in English', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({ cameraActive: true, faceDetected: true, faceCount: 1, expression: 'happy', confidence: 0.91, serviceAvailable: true, lastUpdated: Date.now() }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('What is my expression?'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('happy');
    expect(result.text).toContain('91% confidence');
  });

  it('handles Gujarati vision questions with Gujarati response and expression', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({ cameraActive: true, faceDetected: true, faceCount: 1, expression: 'happy', confidence: 0.88, serviceAvailable: true, lastUpdated: Date.now() }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('મારો expression શું છે?', 'gu'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('ચહેરાના હાવભાવ');
    expect(result.text).toContain('happy');
  });

  it('handles Hindi vision questions with Hindi response when no face is detected', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({ cameraActive: true, faceDetected: false, faceCount: 0, expression: 'none', confidence: 0, serviceAvailable: true, lastUpdated: Date.now() }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('क्या तुम मुझे देख सकते हो?', 'hi'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('चेहरा दिखाई नहीं दे रहा है');
  });

  it('returns no-face message in English when user leaves camera view or is not in frame', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({ cameraActive: true, faceDetected: false, faceCount: 0, expression: 'none', confidence: 0, serviceAvailable: true, lastUpdated: Date.now() }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('Can you see me?'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('do not detect any face in the frame');
  });

  it('answers face-count questions from the current vision result', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({
        cameraActive: true,
        faceDetected: true,
        faceCount: 2,
        expression: 'neutral',
        confidence: 0.8,
        serviceAvailable: true,
        lastUpdated: Date.now(),
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'yunet', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('How muxh fadce you seeing'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('2 faces');
    expect(groq.generate).not.toHaveBeenCalled();
  });

  it('returns zero for a face-count question when the current frame has no face', async () => {
    const vision = {
      getLatestState: vi.fn().mockReturnValue({
        cameraActive: true,
        faceDetected: false,
        faceCount: 0,
        expression: 'none',
        confidence: 0,
        serviceAvailable: true,
        lastUpdated: Date.now(),
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'yunet', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('How many faces do you see?'), { vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('0 faces');
  });

  it('returns stale message when frame data is older than 3.5 seconds', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({
        cameraActive: true,
        faceDetected: true,
        faceCount: 1,
        expression: 'happy',
        confidence: 0.9,
        serviceAvailable: true,
        lastUpdated: Date.now() - 5000,
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('Can you see me?'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('unavailable or stale');
  });

  it('routes "How many fingers am I showing?" to vision and returns real finger count', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({
        cameraActive: true,
        handDetected: true,
        handCount: 1,
        fingerCount: 3,
        fingers: { thumb: true, index: true, middle: true, ring: false, pinky: false },
        serviceAvailable: true,
        lastUpdated: Date.now(),
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('How many fingers am I showing?'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('3 visible fingers');
  });

  it('handles two hands finger counting question', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({
        cameraActive: true,
        handDetected: true,
        handCount: 2,
        fingerCount: 8,
        serviceAvailable: true,
        lastUpdated: Date.now(),
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('Can you count my fingers?'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('8 visible fingers across both hands');
  });

  it('returns the number of hands, not fingers, for hand-count questions', async () => {
    const vision = {
      getLatestState: vi.fn().mockReturnValue({
        cameraActive: true,
        handDetected: true,
        handCount: 2,
        fingerCount: 5,
        serviceAvailable: true,
        lastUpdated: Date.now(),
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'mediapipe-hands', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('How much hands seeing?'), { vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('2 visible hands');
    expect(result.text).not.toContain('5 visible fingers');
  });

  it('returns camera-off message when asking finger questions with camera disabled', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({ cameraActive: false, serviceAvailable: true, lastUpdated: 0 }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('How many fingers am I holding up?'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain("camera is currently off, so I can't detect your fingers");
  });

  it('returns no-hand message when camera is active but no hand is visible', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };
    const vision = {
      getLatestState: vi.fn().mockReturnValue({
        cameraActive: true,
        handDetected: false,
        handCount: 0,
        fingerCount: 0,
        serviceAvailable: true,
        lastUpdated: Date.now(),
      }),
      checkHealth: vi.fn().mockResolvedValue({ status: 'online', available: true, provider: 'local-python', model: 'fer', device: 'cpu' }),
    };

    const result = await routeAiRequest(input('Count my fingers'), { groq, search, ollama, vision });

    expect(result.source).toBe('vision');
    expect(result.text).toContain('do not detect any visible hand or fingers');
  });

  it('returns only the date when asked for today\'s date', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };

    const result = await routeAiRequest({
      ...input("What is today's date?"),
      runtimeContext: { currentTime: '2026-09-19T09:00:00.000Z', timezone: 'Asia/Kolkata' },
    }, { groq, search, ollama });

    expect(result.source).toBe('current_time');
    expect(result.text).toContain('September 19, 2026');
    expect(result.text).not.toContain('9:00');
    expect(result.text).not.toContain('AM');
    expect(result.text).not.toContain('PM');
  });

  it('sanitizes SVG-like message payloads before rendering', () => {
    const svgPayload = { tagName: 'svg', ownerSVGElement: null } as unknown as string;

    const mapped = mapMessage({
      id: 'msg-1',
      sender: 'assistant',
      content: svgPayload,
      createdAt: '2026-09-19T09:00:00.000Z',
    } as any);

    expect(mapped.content).toBe('');
  });

  it('includes the latest valid vision JSON in the AI prompt when the frame is fresh', () => {
    const context = buildVisionContextForPrompt({
      cameraActive: true,
      faceDetected: true,
      faceCount: 1,
      expression: 'happy',
      confidence: 0.91,
      landmarksDetected: true,
      handDetected: false,
      handCount: 0,
      fingerCount: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      hands: [],
      fingerConfidence: 0,
      serviceAvailable: true,
      lastUpdated: Date.now(),
      timestamp: new Date().toISOString(),
      processingTimeMs: 35,
      available: true,
    });

    expect(context).toContain('"faceDetected": true');
    expect(context).toContain('"expression": "happy"');
    expect(context).toContain('latest valid vision JSON');
  });

  it('omits stale vision JSON from the AI prompt', () => {
    const context = buildVisionContextForPrompt({
      cameraActive: true,
      faceDetected: true,
      faceCount: 1,
      expression: 'happy',
      confidence: 0.91,
      landmarksDetected: true,
      handDetected: false,
      handCount: 0,
      fingerCount: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      hands: [],
      fingerConfidence: 0,
      serviceAvailable: true,
      lastUpdated: Date.now() - 6000,
      timestamp: new Date().toISOString(),
      processingTimeMs: 35,
      available: true,
    });

    expect(context).toContain('no recent usable frame data');
    expect(context).not.toContain('"faceDetected": true');
  });
});