import { describe, it, expect } from 'vitest';
import { computeTopResponders } from '../resultProcessor';
import type { AnswerData } from '../../types/quiz';

const baseStart = 1_700_000_000_000;

function makeRow(rowIndex: number, email: string | null, tsOffsetMs: number, answerKey: string, answerValue: string, name?: string): AnswerData {
  const ts = baseStart + tsOffsetMs;
  const r: AnswerData = {
    __rowIndex: rowIndex,
    __raw: [],
    __timestampMs: ts,
    [answerKey]: answerValue,
  } as any;
  if (email !== null) r['メールアドレス'] = email;
  if (name !== undefined) r.name = name;
  return r;
}

describe('resultProcessor.computeTopResponders', () => {
  it('returns top responders in early order and formats timeToAnswer', () => {
    const answers: AnswerData[] = [
      makeRow(2, 'a@example.com', 5000, 'Q1', '○', 'A'),
      makeRow(3, 'b@example.com', 2000, 'Q1', '○', 'B'),
      makeRow(4, 'c@example.com', 8000, 'Q1', '×', 'C'),
    ];

    const result = computeTopResponders(answers, {
      answerKey: 'Q1',
      correctValue: '○',
      limit: 3,
      uniqueByEmail: true,
      excludeMissingEmail: true,
      quizStartTimeMs: baseStart,
    });

    // Expect order: b (2000ms), a (5000ms), placeholder
    expect(result[0].name).toBe('B');
    expect(result[1].name).toBe('A');
    expect((result[0] as any).__timeToAnswer).toBe('2.000秒');
    expect((result[1] as any).__timeToAnswer).toBe('5.000秒');
    expect((result[2] as any).__isPlaceholder).toBe(true);
  });

  it('handles duplicate emails by taking the last answer', () => {
    const answers: AnswerData[] = [
      makeRow(2, 'dup@example.com', 1000, 'Q1', '○', 'User1'),
      makeRow(3, 'dup@example.com', 3000, 'Q1', '○', 'User1'),
      makeRow(4, 'other@example.com', 2000, 'Q1', '○', 'User2'),
    ];

    const result = computeTopResponders(answers, {
      answerKey: 'Q1',
      correctValue: '○',
      limit: 2,
      uniqueByEmail: true,
      excludeMissingEmail: true,
      quizStartTimeMs: baseStart,
    });

    // dup should contribute with latest timestamp 3000ms, other is 2000ms -> order other, dup
    expect(result[0]['メールアドレス']).toBe('other@example.com');
    expect(result[1]['メールアドレス']).toBe('dup@example.com');
  });

  it('excludes rows with missing timestamp or missing answer', () => {
    const a1 = makeRow(2, 'a@example.com', 1000, 'Q1', '○', 'A');
    const bad1 = { __rowIndex: 5, __raw: [], 'Q1': '○' } as any; // missing timestamp
    const bad2 = makeRow(6, 'b@example.com', 1000, 'Q1', '×', 'B');

    const result = computeTopResponders([a1, bad1, bad2], {
      answerKey: 'Q1',
      correctValue: '○',
      limit: 2,
      uniqueByEmail: true,
      excludeMissingEmail: true,
      quizStartTimeMs: baseStart,
    });

    expect(result.length).toBe(2);
    expect(result[0].name).toBe('A');
    expect((result[1] as any).__isPlaceholder).toBe(true);
  });
});
