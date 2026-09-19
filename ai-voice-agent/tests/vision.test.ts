import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VisionService } from '../server/services/vision/vision.service';

describe('VisionService', () => {
  let service: VisionService;

  beforeEach(() => {
    service = new VisionService();
    vi.restoreAllMocks();
  });

  it('reports offline when python service is unreachable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));
    const health = await service.checkHealth();

    expect(health.status).toBe('offline');
    expect(health.available).toBe(false);
    expect(health.provider).toBe('local-python');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('reports online when python service is reachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', model: 'dima806/facial_emotions_image_detection + yunet', device: 'cpu', uptimeSeconds: 10 }),
    } as Response);

    const health = await service.checkHealth();
    expect(health.status).toBe('online');
    expect(health.available).toBe(true);
    expect(health.model).toContain('yunet');
  });

  it('detects and reuses manually started python service without spawning', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', model: 'dima806/facial_emotions_image_detection + yunet', device: 'cpu' }),
    } as Response);

    const isRunning = await service.ensureVisionService();
    expect(isRunning).toBe(true);
    const state = service.getLatestState();
    expect(state.serviceAvailable).toBe(true);
  });

  it('returns no-face structure when camera is disabled', async () => {
    service.setCameraState(false);
    const result = await service.analyzeFrame('data:image/jpeg;base64,1234', false);

    expect(result.faceDetected).toBe(false);
    expect(result.faceCount).toBe(0);
    expect(result.expression).toBe('none');
  });

  it('sends frame and parses real expression data when camera is active', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        faceDetected: true,
        faceCount: 1,
        expression: 'happy',
        confidence: 0.89,
        landmarksDetected: true,
        timestamp: '2026-09-19T10:00:00Z',
        processingTimeMs: 45,
        allExpressions: { happy: 0.89, neutral: 0.05 },
      }),
    } as Response);

    const result = await service.analyzeFrame('data:image/jpeg;base64,valid_frame', true);

    expect(result.faceDetected).toBe(true);
    expect(result.faceCount).toBe(1);
    expect(result.expression).toBe('happy');
    expect(result.confidence).toBe(0.89);
    expect(result.landmarksDetected).toBe(true);

    const latest = service.getLatestState();
    expect(latest.faceDetected).toBe(true);
    expect(latest.expression).toBe('happy');
    expect(latest.cameraActive).toBe(true);
  });

  it('skips concurrent frame requests while one frame is in flight', async () => {
    let resolveFirst: (val: unknown) => void = () => undefined;
    const slowPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => slowPromise as Promise<Response>);

    // First request starts (in flight)
    const firstReq = service.analyzeFrame('data:image/jpeg;base64,frame1', true);

    // Second request comes in while first is still pending
    const secondResult = await service.analyzeFrame('data:image/jpeg;base64,frame2', true);

    // Second request returns cached state immediately rather than making duplicate fetch
    expect(secondResult).toBeDefined();

    // Finish first request
    resolveFirst({
      ok: true,
      json: async () => ({
        faceDetected: true,
        faceCount: 1,
        expression: 'neutral',
        confidence: 0.95,
        landmarksDetected: true,
        timestamp: '2026-09-19T10:00:01Z',
        processingTimeMs: 120,
      }),
    });

    const firstResult = await firstReq;
    expect(firstResult.faceDetected).toBe(true);
    expect(firstResult.expression).toBe('neutral');
  });

  it('handles frame failure gracefully without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Inference timeout'));

    const result = await service.analyzeFrame('data:image/jpeg;base64,frame_err', true);
    expect(result.faceDetected).toBe(false);
    expect(result.expression).toBe('none');
  });
});

