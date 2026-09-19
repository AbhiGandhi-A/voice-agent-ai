import express, { Express } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer, WebSocket } from 'ws';
import { env, isOriginAllowed } from './config/env';
import { logger } from './utils/logger';
import { requestContext } from './middleware/auth';
import { notFoundHandler, errorHandler } from './middleware/error';
import { buildApiRouter } from './routes/index';
import { handleMediaSocket } from './routes/media-stream.ws';
import { closeAllMediaSessions } from './services/telephony/bridge-registry';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
// Works in both run modes: `tsx server/index.ts` (SERVER_DIR = <root>/server)
// and `node dist/server.js` (SERVER_DIR = <root>/dist) resolve to the same root.
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');
const CLIENT_DIST = path.resolve(PROJECT_ROOT, 'dist', 'client');

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // The backend is reached through a local proxy tunnel (cloudflared/ngrok),
  // which appends X-Forwarded-For. Trust only loopback proxies so
  // express-rate-limit and req.ip see the real client IP without letting
  // arbitrary upstream IPs spoof the header.
  app.set('trust proxy', 'loopback');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ): void => {
      const origin = req.headers.origin;
      if (origin && !isOriginAllowed(origin)) {
        logger.warn('cors_rejected_origin', { origin });
        res.status(403).json({ error: 'Not allowed by CORS' });
        return;
      }
      next();
    }
  );
  app.use(
    cors({
      // origin callback returns true only for allowed origins; requests without
      // an Origin header (curl, telephony webhooks, WebSocket clients) pass.
      origin: (origin, callback) => callback(null, !origin || isOriginAllowed(origin)),
      credentials: true,
    })
  );
  app.use(express.json({ limit: `${env.requestBodyLimitMb}mb` }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(requestContext);

  app.use('/api', buildApiRouter());

  // Serve the built frontend (dist/client). In dev, Vite serves the app instead.
  app.use(express.static(CLIENT_DIST, { maxAge: env.isProd ? '1h' : 0 }));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
      if (err) res.status(404).send('Frontend not built. Run npm run build.');
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export function createServer(): { server: http.Server; wss: WebSocketServer; start: () => Promise<void>; shutdown: () => Promise<void> } {
  const app = createApp();
  const server = http.createServer(app);

  // Provider media-stream bridge (Twilio <Stream> websocket pushes audio here).
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const url = request.url ?? '';
    if (url.startsWith('/api/telephony/media')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        handleMediaSocket(ws as WebSocket);
      });
      return;
    }
    socket.destroy();
  });

  const start = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.listen(env.port, () => resolve()));
    logger.info('server_started', {
      port: env.port,
      environment: env.nodeEnv,
      healthUrl: `${env.appUrl.replace(/\/$/, '')}/api/health`,
    });
  };

  const shutdown = async (): Promise<void> => {
    await closeAllMediaSessions();
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info('server_stopped', {});
  };

  return { server, wss, start, shutdown };
}

// Bootstrap only when run directly (not when imported by tests).
const isMain = process.argv[1] && pathToFileUrl(process.argv[1]) === import.meta.url;

if (isMain) {
  const { start, shutdown } = createServer();
  void start();
  const handleExit = (): void => {
    void shutdown().finally(() => process.exit(0));
  };
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
  // Express 4 does not catch rejections from async route handlers. Rather than
  // letting one failing request kill the whole server, log it and keep serving
  // (the route will 500 to that caller instead of hanging the process).
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

function pathToFileUrl(p: string): string {
  if (p.startsWith('file:')) return p;
  return 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/^\/+/, '');
}