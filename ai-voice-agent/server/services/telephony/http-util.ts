import type { Request } from 'express';
import type { IncomingMessage } from 'http';

export function getHeader(req: Request | IncomingMessage, name: string): string | null {
  const h = (req.headers as Record<string, unknown>)[name.toLowerCase()];
  return (Array.isArray(h) ? h[0] : h) as string | null;
}