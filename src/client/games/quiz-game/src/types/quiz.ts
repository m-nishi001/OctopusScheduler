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

/**
 * Normalize an answer/value for robust comparison.
 * - trims whitespace
 * - applies Unicode NFKC normalization if available
 * - strips a leading numbering like "1: " or "1．"
 * - lowercases ASCII letters for case-insensitive comparison
 */
export function normalizeAnswer(value?: string | null): string {
  if (value === undefined || value === null) return "";
  try {
    let s = String(value).trim();
    if ((s as any).normalize) {
      s = (s as any).normalize("NFKC");
    }
    // remove leading numbering like "1: " or "1．" or "1. "
    s = s.replace(/^\s*\d+\s*[:．\.\-]\s*/, "");
    // lowercase (ASCII letters) to make comparisons case-insensitive for Latin
    s = s.toLowerCase();
    return s;
  } catch (e) {
    return String(value ?? "");
  }
}
