import { logger } from '../../utils/logger';

export interface VisionAnalysisResult {
  faceDetected: boolean;
  faceCount: number;
  expression: string;
  confidence: number;
  landmarksDetected: boolean;
  timestamp: string;
  processingTimeMs: number;
  allExpressions?: Record<string, number>;
  available?: boolean;
}

export interface VisionServiceHealth {
  status: 'online' | 'offline';
  available: boolean;
  provider: string;
  model: string;
  device: string;
  uptimeSeconds?: number;
  latencyMs?: number;
}

export interface CachedVisionState extends VisionAnalysisResult {
  cameraActive: boolean;
  serviceAvailable: boolean;
  lastUpdated: number;
}

const PYTHON_VISION_URL = process.env.VISION_SERVICE_URL || 'http://127.0.0.1:8000';
const REQUEST_TIMEOUT_MS = 3000;
const HEALTH_TIMEOUT_MS = 1500;

export class VisionService {
  private latestState: CachedVisionState = {
    faceDetected: false,
    faceCount: 0,
    expression: 'none',
    confidence: 0,
    landmarksDetected: false,
    timestamp: new Date().toISOString(),
    processingTimeMs: 0,
    cameraActive: false,
    serviceAvailable: false,
    lastUpdated: 0,
  };

  public async checkHealth(): Promise<VisionServiceHealth> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(`${PYTHON_VISION_URL}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          status: 'offline',
          available: false,
          provider: 'local-python',
          model: 'dima806/facial_emotions_image_detection + yunet',
          device: 'cpu',
        };
      }

      const data = (await response.json()) as { status?: string; model?: string; device?: string; uptimeSeconds?: number };
      const latencyMs = Date.now() - startedAt;

      this.latestState.serviceAvailable = true;

      return {
        status: 'online',
        available: true,
        provider: 'local-python',
        model: data.model || 'dima806/facial_emotions_image_detection + yunet',
        device: data.device || 'cpu',
        uptimeSeconds: data.uptimeSeconds,
        latencyMs,
      };
    } catch (error) {
      this.latestState.serviceAvailable = false;
      return {
        status: 'offline',
        available: false,
        provider: 'local-python',
        model: 'dima806/facial_emotions_image_detection + yunet',
        device: 'cpu',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  public async analyzeFrame(imageBase64: string, cameraActive = true): Promise<VisionAnalysisResult> {
    this.latestState.cameraActive = cameraActive;
    if (!cameraActive) {
      this.latestState.faceDetected = false;
      this.latestState.expression = 'none';
      this.latestState.confidence = 0;
      return {
        faceDetected: false,
        faceCount: 0,
        expression: 'none',
        confidence: 0,
        landmarksDetected: false,
        timestamp: new Date().toISOString(),
        processingTimeMs: 0,
        available: this.latestState.serviceAvailable,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${PYTHON_VISION_URL}/analyze-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ image: imageBase64 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn('[VISION] Python service returned non-200 status', { status: response.status });
        return {
          faceDetected: false,
          faceCount: 0,
          expression: 'uncertain',
          confidence: 0,
          landmarksDetected: false,
          timestamp: new Date().toISOString(),
          processingTimeMs: 0,
          available: false,
        };
      }

      const data = (await response.json()) as VisionAnalysisResult;
      data.available = true;

      this.latestState = {
        ...data,
        cameraActive: true,
        serviceAvailable: true,
        lastUpdated: Date.now(),
      };

      return data;
    } catch (error) {
      logger.warn('[VISION] Python service request failed', {
        message: error instanceof Error ? error.message : 'connection refused',
      });
      this.latestState.serviceAvailable = false;
      return {
        faceDetected: false,
        faceCount: 0,
        expression: 'none',
        confidence: 0,
        landmarksDetected: false,
        timestamp: new Date().toISOString(),
        processingTimeMs: 0,
        available: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  public setCameraState(active: boolean): void {
    this.latestState.cameraActive = active;
    if (!active) {
      this.latestState.faceDetected = false;
      this.latestState.expression = 'none';
      this.latestState.confidence = 0;
    }
  }

  public getLatestState(): CachedVisionState {
    return { ...this.latestState };
  }
}

export const visionService = new VisionService();

