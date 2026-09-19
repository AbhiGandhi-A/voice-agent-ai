import { spawn, ChildProcess } from 'child_process';
import path from 'path';
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
  private pythonProcess: ChildProcess | null = null;
  private isSpawning = false;
  private spawnAttempts = 0;

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

  public startServiceProcess(): void {
    if (this.pythonProcess || this.isSpawning || this.spawnAttempts > 3) return;
    this.isSpawning = true;
    this.spawnAttempts++;
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    try {
      const proc = spawn(pythonCmd, ['vision_service/main.py'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      proc.stdout?.on('data', (data: Buffer) => {
        logger.info(`[VISION-PROC] ${data.toString().trim()}`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) logger.info(`[VISION-PROC] ${msg}`);
      });

      proc.on('error', (err: Error) => {
        logger.warn('[VISION] Failed to spawn python vision process', { error: err.message });
        this.pythonProcess = null;
        this.isSpawning = false;
      });

      proc.on('exit', (code: number | null) => {
        logger.info(`[VISION] Python vision process exited with code ${code}`);
        this.pythonProcess = null;
        this.isSpawning = false;
      });

      this.pythonProcess = proc;
      this.isSpawning = false;
    } catch (err) {
      logger.warn('[VISION] Could not spawn python process', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.isSpawning = false;
    }
  }

  public stopServiceProcess(): void {
    if (this.pythonProcess) {
      try {
        this.pythonProcess.kill();
      } catch {
        // ignore
      }
      this.pythonProcess = null;
    }
  }

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
      // If offline and not running in test mode, attempt to auto-start Python service
      if (process.env.NODE_ENV !== 'test') {
        this.startServiceProcess();
      }
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

