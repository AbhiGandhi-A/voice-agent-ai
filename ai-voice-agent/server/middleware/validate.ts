import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { ApiError } from './error';

export type ValidationSource = 'body' | 'query' | 'params';

/** Validates a request slice against a Zod schema. */
export function validate(schema: ZodType, source: ValidationSource = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      const message = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request.';
      next(new ApiError(400, 'validation_error', message));
      return;
    }
    req[source] = result.data as never;
    next();
  };
}

export function parseId(value: string, label = 'id'): string {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(value)) throw new ApiError(400, 'validation_error', `Invalid ${label}.`);
  return value;
}