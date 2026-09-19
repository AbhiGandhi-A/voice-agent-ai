import { spawn, ChildProcess } from 'child_process';
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
const REQUEST_TIMEOUT_MS = 12000;
const HEALTH_TIMEOUT_MS = 3000;

export class VisionService {
  private pythonProcess: ChildProcess | null = null;
  private isSpawning = false;
  private spawnAttempts = 0;
  private maxSpawnAttempts = 3;
  private startupPromise: Promise<boolean> | null = null;
  private isManuallyStarted = false;
  private frameInFlight = false;

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

  /**
   * Check if the vision service endpoint is currently responding to /health.
   */
  public async isServiceResponsive(timeoutMs = 1500): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${PYTHON_VISION_URL}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Ensures the vision service is running:
   * First probes the HTTP endpoint to detect any manually started instance.
   * If not responding, safely spawns a single child process.
   */
  public async ensureVisionService(): Promise<boolean> {
    if (this.startupPromise) {
      return this.startupPromise;
    }

    const alive = await this.isServiceResponsive();
    if (alive) {
      this.latestState.serviceAvailable = true;
      if (!this.pythonProcess && !this.isManuallyStarted) {
        this.isManuallyStarted = true;
        logger.info(`[VISION] Existing Python vision service detected at ${PYTHON_VISION_URL}`);
      }
      return true;
    }

    if (process.env.NODE_ENV === 'test') {
      return false;
    }

    this.startupPromise = this.doSpawnAndVerify().finally(() => {
      this.startupPromise = null;
    });

    return this.startupPromise;
  }

  private async doSpawnAndVerify(): Promise<boolean> {
    if (this.pythonProcess || this.isSpawning || this.spawnAttempts >= this.maxSpawnAttempts) {
      return false;
    }

    const alreadyUp = await this.isServiceResponsive(1000);
    if (alreadyUp) {
      this.latestState.serviceAvailable = true;
      this.isManuallyStarted = true;
      return true;
    }

    this.isSpawning = true;
    this.spawnAttempts++;
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    try {
      logger.info(`[VISION] Spawning Python vision service (attempt ${this.spawnAttempts}/${this.maxSpawnAttempts})...`);
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

      // Poll /health up to 8 times to verify service readiness
      for (let i = 0; i < 8; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (await this.isServiceResponsive(800)) {
          this.latestState.serviceAvailable = true;
          logger.info(`[VISION] Python vision service is now online and ready on ${PYTHON_VISION_URL}`);
          return true;
        }
      }

      return false;
    } catch (err) {
      logger.warn('[VISION] Could not spawn python process', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.isSpawning = false;
      return false;
    }
  }

  public startServiceProcess(): void {
    void this.ensureVisionService();
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
        this.latestState.serviceAvailable = false;
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

    if (this.frameInFlight) {
      logger.debug('[VISION] Frame request skipped because another frame is in flight');
      return {
        faceDetected: this.latestState.faceDetected,
        faceCount: this.latestState.faceCount,
        expression: this.latestState.expression,
        confidence: this.latestState.confidence,
        landmarksDetected: this.latestState.landmarksDetected,
        timestamp: this.latestState.timestamp,
        processingTimeMs: this.latestState.processingTimeMs,
        allExpressions: this.latestState.allExpressions,
        available: this.latestState.serviceAvailable,
      };
    }

    this.frameInFlight = true;
    const startedAt = Date.now();
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
          processingTimeMs: Date.now() - startedAt,
          available: this.latestState.serviceAvailable,
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

      const duration = Date.now() - startedAt;
      logger.info(`[VISION] Frame analyzed in ${duration}ms: face=${data.faceDetected} (${data.faceCount}) expr=${data.expression} conf=${data.confidence}`);

      return data;
    } catch (error) {
      logger.warn('[VISION] Python vision frame analysis failed', {
        message: error instanceof Error ? error.message : 'connection refused',
      });
      return {
        faceDetected: false,
        faceCount: 0,
        expression: 'none',
        confidence: 0,
        landmarksDetected: false,
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startedAt,
        available: this.latestState.serviceAvailable,
      };
    } finally {
      clearTimeout(timer);
      this.frameInFlight = false;
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
