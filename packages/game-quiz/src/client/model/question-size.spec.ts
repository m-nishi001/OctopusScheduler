import { describe, it, expect } from 'vitest';
import { questionSizeOf } from './question-size';

describe('questionSizeOf', () => {
  it('treats up to 40 characters as short', () => {
    expect(questionSizeOf('')).toBe('short');
    expect(questionSizeOf('あ'.repeat(40))).toBe('short');
  });

  it('treats 41 to 80 characters as medium', () => {
    expect(questionSizeOf('あ'.repeat(41))).toBe('medium');
    expect(questionSizeOf('あ'.repeat(80))).toBe('medium');
  });

  it('treats more than 80 characters as long', () => {
    expect(questionSizeOf('あ'.repeat(81))).toBe('long');
  });

  it('counts code points and ignores surrounding whitespace', () => {
    expect(questionSizeOf('😀'.repeat(40))).toBe('short');
    expect(questionSizeOf(`  ${'あ'.repeat(40)}  `)).toBe('short');
  });
});
