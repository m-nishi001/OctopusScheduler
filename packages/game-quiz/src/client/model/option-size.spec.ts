import { describe, it, expect } from 'vitest';
import { MIN_FIT, largestFittingScale, optionSizeOf } from './option-size';

describe('optionSizeOf', () => {
  it('treats up to 10 characters as short', () => {
    expect(optionSizeOf('')).toBe('short');
    expect(optionSizeOf('あ'.repeat(10))).toBe('short');
  });

  it('treats 11 to 20 characters as medium', () => {
    expect(optionSizeOf('あ'.repeat(11))).toBe('medium');
    expect(optionSizeOf('あ'.repeat(20))).toBe('medium');
  });

  it('treats more than 20 characters as long', () => {
    expect(optionSizeOf('あ'.repeat(21))).toBe('long');
  });

  it('counts code points and ignores surrounding whitespace', () => {
    expect(optionSizeOf('😀'.repeat(10))).toBe('short');
    expect(optionSizeOf(`  ${'あ'.repeat(10)}  `)).toBe('short');
  });
});

describe('largestFittingScale', () => {
  it('keeps the original size when the text already fits', () => {
    const tried: number[] = [];
    expect(largestFittingScale((s) => (tried.push(s), true))).toBe(1);
    expect(tried).toEqual([1]);
  });

  it('returns the largest scale that fits, within 1%', () => {
    for (const limit of [0.95, 0.63, 0.3, 0.11]) {
      const scale = largestFittingScale((s) => s <= limit);
      expect(scale).toBeLessThanOrEqual(limit);
      expect(limit - scale).toBeLessThan(0.01);
    }
  });

  it('stops at the minimum scale when nothing fits', () => {
    expect(largestFittingScale(() => false)).toBe(MIN_FIT);
  });
});
