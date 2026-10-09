/**
 * セッショントークンをRPC引数に相乗りさせるためのエンベロープ。
 *
 * 引数が文字列や未指定のAPIもあるため、引数オブジェクトへ直接プロパティを足さず、
 * ログイン中のみ `{ __octopusAuth: token, args }` に包んで送る。サーバー側は全ハンドラ
 * が `unwrapAuth` を通すので、未ログイン(包まれていない)の呼び出しもそのまま扱える。
 */
export const AUTH_ENVELOPE_KEY = "__octopusAuth";

interface AuthEnvelope {
  [AUTH_ENVELOPE_KEY]: string;
  args?: unknown;
}

/** token が無ければ args をそのまま返す。 */
export function wrapWithAuth(token: string | null | undefined, args: unknown): unknown {
  if (!token) return args;
  const envelope: AuthEnvelope = { [AUTH_ENVELOPE_KEY]: token, args };
  return envelope;
}

export function unwrapAuth(raw: unknown): { token: string | null; args: unknown } {
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as Record<string, unknown>)[AUTH_ENVELOPE_KEY] === "string"
  ) {
    const envelope = raw as unknown as AuthEnvelope;
    return { token: envelope[AUTH_ENVELOPE_KEY], args: envelope.args };
  }
  return { token: null, args: raw };
}
