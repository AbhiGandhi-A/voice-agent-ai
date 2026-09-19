import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Resource not found.' });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error.';
  logger.error('unhandled_error', { requestId: req.requestId, message });
  res.status(500).json({ error: 'Internal server error.' });
}