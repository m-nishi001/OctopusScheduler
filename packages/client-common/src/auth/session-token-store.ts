/**
 * ログイン中の管理者セッショントークンを保持する(メモリ + localStorage)。
 * APIクライアントが呼び出しごとに読み、サーバーへ自動で付与する。
 * localStorage が使えない環境(プライベートモード等)でもメモリ上では動く。
 */
const STORAGE_KEY = "octopus-session-token";

let memoryToken: string | null | undefined;

export function getSessionToken(): string | null {
  if (memoryToken !== undefined) return memoryToken;
  try {
    memoryToken = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function setSessionToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) globalThis.localStorage?.setItem(STORAGE_KEY, token);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // 永続化できなくてもメモリ上のトークンで動作を続ける
  }
}
