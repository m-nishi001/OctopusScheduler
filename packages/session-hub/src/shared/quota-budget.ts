/**
 * Cloudflare 無料枠の予算。ゲーム中に枠が尽きないよう、想定最大の負荷でも使用量を
 * 無料枠の一定割合(BUDGET_RATIO)に収めることを、テストで強制する。
 *
 * 出典(2026-10 時点で確認): Cloudflare 公式ドキュメント
 *   - Workers Free: 100,000 requests/day            https://developers.cloudflare.com/workers/platform/limits/
 *   - Durable Objects Free: 100,000 requests/day, 5M rows read/day, 100,000 rows written/day,
 *     WebSocket は接続=1リクエスト・受信メッセージ20件=1リクエスト・送信は課金なし
 *                                                    https://developers.cloudflare.com/durable-objects/platform/pricing/
 *   - D1 Free: 5M rows read/day, 100,000 rows written/day    https://developers.cloudflare.com/d1/platform/pricing/
 *   - R2 Free: Class A 1M/月, Class B 10M/月                  https://developers.cloudflare.com/r2/pricing/
 * 無料枠の数値は変わり得る。変更を見つけたらここだけを更新し、テストで再検証する。
 */
export const FREE_TIER = {
  workersRequestsPerDay: 100_000,
  doRequestsPerDay: 100_000,
  doRowsReadPerDay: 5_000_000,
  doRowsWrittenPerDay: 100_000,
} as const;

/** 想定最大の負荷でも、無料枠のこの割合を超えないようにする(残りは予備・他の用途・再試行の余力)。 */
export const BUDGET_RATIO = 0.3;

/** WebSocket の受信メッセージは N 件で 1 リクエストとして課金される。 */
export const WS_MESSAGES_PER_REQUEST = 20;

/**
 * 想定する最大規模のイベント(予算テストの前提)。
 * 参加者300人・2時間のイベントを1日2回行う、という目安。
 */
export const EXPECTED_LOAD = {
  clients: 300,
  eventsPerDay: 2,
  /** 参加者が全員一斉にリロード/再接続する回数(イベントあたり)。 */
  reconnectStormsPerEvent: 3,
  /** 参加者の入力を受け付ける回数(イベントあたり。例: クイズ20問)。 */
  inputRoundsPerEvent: 20,
  adminCommandsPerEvent: 200,
  hostPublishesPerEvent: 400,
} as const;
