export type RawRow = Array<string | null>;

/**
 * AnswerData: スプレッドシートの1行をヘッダー文字列をキーにしたオブジェクトに変換した型。
 * メタは `__` プレフィックスで衝突を避ける。
 */
export type AnswerData = {
  // 任意のヘッダー名をプロパティとして持つ（例: "タイムスタンプ", "メールアドレス", "無題の質問"）
  [key: string]: string | number | null | RawRow | undefined | boolean;
} & {
  __rowIndex: number; // 1-based
  __raw: RawRow;
  name?: string | null;
  __timestampMs?: number | null;
  __isPlaceholder?: boolean;
};

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  try {
    return String(email).toLowerCase().trim();
  } catch (e) {
    return null;
  }
}
