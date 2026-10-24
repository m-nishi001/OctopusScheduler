import { describe, it, expect } from 'vitest';
import { openingNextRoute } from './use-opening-next-route';

describe('openingNextRoute', () => {
  it('セッションのホスト(本番)で、エントリーした人のみなら、共通のエントリー画面へ進む', () => {
    expect(openingNextRoute(true, false, 'entrants')).toBe('/jackpot-entry');
  });

  it('参加者全員(自動)なら、ホスト(本番)でもエントリー画面を挟まず説明へ進む', () => {
    expect(openingNextRoute(true, false, 'auto')).toBe('/jackpot-description');
  });

  it('デモ・ホストでない端末(単体実行・プレビュー)は、対象によらず説明へ進む', () => {
    for (const pool of ['auto', 'entrants'] as const) {
      expect(openingNextRoute(true, true, pool)).toBe('/jackpot-description');
      expect(openingNextRoute(false, false, pool)).toBe('/jackpot-description');
      expect(openingNextRoute(false, true, pool)).toBe('/jackpot-description');
    }
  });
});
