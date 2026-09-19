type Meta = Record<string, unknown>;

/** Structured JSON-line logger. Never logs secrets (only pre-sanitized fields reach here). */
export const logger = {
  info(message: string, meta: Meta = {}): void {
    write('info', message, meta);
  },
  warn(message: string, meta: Meta = {}): void {
    write('warn', message, meta);
  },
  error(message: string, meta: Meta = {}): void {
    write('error', message, meta);
  },
};

function write(level: 'info' | 'warn' | 'error', message: string, meta: Meta): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...sanitize(meta),
  });
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(line);
}

/** Strips anything that could contain secrets before logging. */
function sanitize(meta: Meta): Meta {
  const clean: Meta = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (/(token|secret|password|apikey|api_key|key|authorization|credentials)/.test(lower)) continue;
    if (typeof value === 'string' && value.length > 500) clean[key] = value.slice(0, 500) + '…';
    else clean[key] = value;
  }
  return clean;
}

let idCounter = 0;
export function requestId(): string {
  idCounter = (idCounter + 1) % 0xffff;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}`;
}