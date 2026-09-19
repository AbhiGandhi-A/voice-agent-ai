import rateLimit from 'express-rate-limit';
import { ApiError } from './error';

function limiter(windowMs: number, max: number, skipSuccessful = true) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: skipSuccessful,
    handler: (_req, _res) => {
      throw new ApiError(429, 'rate_limited', 'Too many requests. Please slow down.');
    },
  });
}

export const authRateLimit = limiter(15 * 60 * 1000, 30, false);
export const aiRateLimit = limiter(60 * 1000, 60);
export const callRateLimit = limiter(60 * 1000, 60);
export const summaryRateLimit = limiter(60 * 1000, 30);
export const webhookRateLimit = limiter(60 * 1000, 300);
export const searchRateLimit = limiter(60 * 1000, 120);