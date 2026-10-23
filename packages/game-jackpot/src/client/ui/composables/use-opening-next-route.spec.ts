import { describe, it, expect } from 'vitest';
import { openingNextRoute } from './use-opening-next-route';

describe('openingNextRoute', () => {
  it('セッションのホスト(本番)は、共通のエントリー画面へ進む', () => {
    expect(openingNextRoute(true, false)).toBe('/jackpot-entry');
  });

  it('デモ・ホストでない端末(単体実行・プレビュー)は、これまでどおり説明へ進む', () => {
    expect(openingNextRoute(true, true)).toBe('/jackpot-description');
    expect(openingNextRoute(false, false)).toBe('/jackpot-description');
    expect(openingNextRoute(false, true)).toBe('/jackpot-description');
  });
});
