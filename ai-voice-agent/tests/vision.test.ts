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
});

