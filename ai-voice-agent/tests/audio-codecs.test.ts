import { describe, it, expect } from 'vitest';
import {
  ulawToLinear,
  linearToUlaw,
  alawToLinear,
  linearToAlaw,
  resample,
  pcmToWav,
} from '../server/services/telephony/voice/audio-codecs';

describe('audio-codecs', () => {
  const samples = [-32768, -8159, -8000, -1000, -255, -1, 0, 1, 255, 1000, 8000, 8159, 32767];

  describe('μ-law', () => {
    it('decodes silence byte 0xFF to zero', () => {
      expect(ulawToLinear(new Uint8Array([0xff]))[0]).toBe(0);
    });

    it('decodes full-scale positive within the law\'s range', () => {
      const v = ulawToLinear(new Uint8Array([0x80]))[0];
      expect(v).toBeGreaterThan(30000);
      expect(v).toBeLessThanOrEqual(32767);
    });

    it('round-trips within quantization tolerance (saturates near law max)', () => {
      for (const s of samples) {
        const encoded = linearToUlaw([s]);
        const decoded = ulawToLinear(encoded);
        const err = Math.abs(decoded[0] - s);
        // The μ-law surface only represents up to ~±32124; beyond that the
        // codec saturates, so extreme inputs may be off by up to ~643.
        if (Math.abs(s) > 30000) {
          expect(err).toBeLessThanOrEqual(700);
        } else {
          expect(err).toBeLessThanOrEqual(320);
        }
      }
    });
  });

  describe('a-law', () => {
    it('round-trips within quantization tolerance', () => {
      for (const s of samples) {
        const encoded = linearToAlaw([s]);
        const decoded = alawToLinear(encoded);
        expect(Math.abs(decoded[0] - s)).toBeLessThanOrEqual(512);
      }
    });

    it('decodes a known negative byte', () => {
      // 0xD5 ^ 0x55 = 0x80 → sign bit set, seg 0, mant 0 → -(8)
      expect(alawToLinear(new Uint8Array([0xd5]))[0]).toBe(-8);
    });
  });

  describe('resample', () => {
    it('doubles sample rate with linear interpolation', () => {
      const out = resample([0, 10, 20], 1000, 2000);
      expect(out.length).toBe(6);
      expect(out[0]).toBe(0);
      expect(out[1]).toBe(5);
      expect(out[2]).toBe(10);
      expect(out[4]).toBe(20);
      expect(out[5]).toBe(20);
    });

    it('halves sample rate', () => {
      const out = resample([0, 2, 4, 6, 8, 10], 2000, 1000);
      expect(out.length).toBe(3);
      expect(out[0]).toBe(0);
      expect(out[1]).toBe(4);
      expect(out[2]).toBe(8);
    });

    it('returns an array equal to the input when rates match', () => {
      const out = resample([1, 2, 3], 8000, 8000);
      expect(Array.from(out)).toEqual([1, 2, 3]);
    });
  });

  describe('pcmToWav', () => {
    const wav = pcmToWav([0x7fff, -0x8000, 0], 16000);

    it('writes RIFF/WAVE/fmt/data chunks', () => {
      expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(wav.subarray(12, 16).toString('ascii')).toBe('fmt ');
      expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
    });

    it('encodes a valid PCM header', () => {
      expect(wav.readUInt32LE(4)).toBe(36 + 6);
      expect(wav.readUInt16LE(20)).toBe(1); // PCM linear
      expect(wav.readUInt16LE(22)).toBe(1); // mono
      expect(wav.readUInt32LE(24)).toBe(16000);
      expect(wav.readUInt16LE(34)).toBe(16);
      expect(wav.readUInt32LE(40)).toBe(6);
    });

    it('writes little-endian 16-bit samples', () => {
      expect(wav.readInt16LE(44)).toBe(0x7fff);
      expect(wav.readInt16LE(46)).toBe(-0x8000);
      expect(wav.readInt16LE(48)).toBe(0);
    });
  });
});