/**
 * 確変(kakuhen)演出シーケンス内の各待機時間(ms)。
 */
export const KAKUHEN_TIMINGS = {
  /** ダミー抽選開始直後、アニメーション側の内部アイテム同期(convertToInternal)を待つ時間。 */
  ANIMATION_ITEM_SYNC_WAIT_MS: 60,
  /** ダミー抽選のスピンダウン所要時間。 */
  DUMMY_SPIN_DOWN_DURATION_MS: 2000,
  /** 確変メッセージ表示時、"kakuhen.finished" イベント待ちのフォールバック時間。 */
  MESSAGE_FINISHED_FALLBACK_MS: 2000,
  /** 確変メッセージ演出完了後、表示を保持する時間。 */
  MESSAGE_HOLD_MS: 1000,
  /** 確変メッセージ非表示時、"kakuhen.dismissed" イベント待ちのフォールバック時間。 */
  MESSAGE_DISMISSED_FALLBACK_MS: 1500,
  /** メッセージ非表示後の追加バッファ。 */
  POST_DISMISS_BUFFER_MS: 500,
  /** ダミー景品ダイアログの表示時間。 */
  DUMMY_PRIZE_DIALOG_DISPLAY_MS: 3000,
  /** 本抽選スピン開始前のバッファ。 */
  FINAL_DRAW_PRE_SPIN_BUFFER_MS: 1500,
  /** 本抽選スピン開始直後のバッファ。 */
  FINAL_DRAW_POST_SPIN_START_BUFFER_MS: 1000,
  /** 本抽選のスピンダウン所要時間。 */
  FINAL_SPIN_DOWN_DURATION_MS: 5000,
} as const;
