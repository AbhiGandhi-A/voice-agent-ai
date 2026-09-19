/**
 * G.711 μ-law / a-law and PCM utilities for the telephony media bridge.
 * Pure-JS implementations so no native audio codecs are required.
 *
 * Encoding is defined as "nearest decode-table entry" so the encode/decode
 * pair is guaranteed self-consistent (|decode(encode(x)) − x| ≤ step/2).
 * Before production integration with a live provider, byte-level behavior
 * should be validated against the provider's own reference G.711 audio.
 */

// ── μ-law (Sun/ITU piecewise-linear law) ──────────────────────────────
function ulawFromBits(exp: number, mant: number, bias = 0x84): number {
  return ((mant << 3) + bias) * 2 ** exp - bias;
}

function buildUlawTable(): Int16Array {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const payload = i ^ 0xff; // μ-law payload bits are bit-inverted
    const sign = payload & 0x80;
    const exp = (payload >> 4) & 0x07;
    const mant = payload & 0x0f;
    let mag = ulawFromBits(exp, mant);
    mag = Math.min(mag, 32767);
    table[i] = sign ? -mag : mag;
  }
  return table;
}

// ── a-law (ITU piecewise-linear law) ──────────────────────────────────
function alawFromBits(exp: number, mant: number): number {
  if (exp === 0) return (mant << 4) + 8;
  return ((mant << 4) + 0x108) * 2 ** (exp - 1);
}

function buildAlawTable(): Int16Array {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const payload = i ^ 0x55;
    const sign = payload & 0x80;
    const exp = (payload >> 4) & 0x07;
    const mant = payload & 0x0f;
    let mag = alawFromBits(exp, mant);
    mag = Math.min(mag, 32767);
    table[i] = sign ? -mag : mag;
  }
  return table;
}

let ulawTable: Int16Array | null = null;
let alawTable: Int16Array | null = null;

function getUlawTable(): Int16Array {
  if (!ulawTable) ulawTable = buildUlawTable();
  return ulawTable;
}

function getAlawTable(): Int16Array {
  if (!alawTable) alawTable = buildAlawTable();
  return alawTable;
}

/** Returns the table index whose linear value is closest to `sample`. */
function nearestByte(sample: number, table: Int16Array): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 256; i++) {
    const d = Math.abs(table[i] - sample);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function ulawToLinear(bytes: Uint8Array): Int16Array {
  const table = getUlawTable();
  const out = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = table[bytes[i]];
  return out;
}

export function alawToLinear(bytes: Uint8Array): Int16Array {
  const table = getAlawTable();
  const out = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = table[bytes[i]];
  return out;
}

/** Linear 16-bit PCM → μ-law bytes (nearest quantization). */
export function linearToUlaw(pcm: Int16Array | number[]): Uint8Array {
  const table = getUlawTable();
  const out = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = nearestByte(clamp16(pcm[i]), table);
  return out;
}

/** Linear 16-bit PCM → a-law bytes (nearest quantization). */
export function linearToAlaw(pcm: Int16Array | number[]): Uint8Array {
  const table = getAlawTable();
  const out = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = nearestByte(clamp16(pcm[i]), table);
  return out;
}

function clamp16(sample: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(sample)));
}

/** Simple linear interpolation resampler (e.g. 8kHz → 16kHz). */
export function resample(input: Int16Array | number[], fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return input instanceof Int16Array ? input : Int16Array.from(input);
  const ratio = toRate / fromRate;
  const outLength = Math.max(0, Math.floor(input.length * ratio));
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i / ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = pos - i0;
    out[i] = Math.round(input[i0] * (1 - frac) + input[i1] * frac);
  }
  return out;
}

/** Renders a WAV header + PCM body (16-bit mono). */
export function pcmToWav(pcm: Int16Array | number[], sampleRate: number): Buffer {
  const bytes = new Uint8Array(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) {
    const s = clamp16(pcm[i]);
    bytes[i * 2] = s & 0xff;
    bytes[i * 2 + 1] = (s >> 8) & 0xff;
  }
  const buf = Buffer.alloc(44 + bytes.length);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + bytes.length, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(bytes.length, 40);
  Buffer.from(bytes).copy(buf, 44);
  return buf;
}