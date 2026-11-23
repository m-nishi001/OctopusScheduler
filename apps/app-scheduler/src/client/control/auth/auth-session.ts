import { computed, readonly, ref } from "vue";
import { container } from "tsyringe";
import { AccountsRepository } from "@octopus/accounts";
import type { Member } from "@octopus/accounts";
import { getSessionToken, setSessionToken } from "@octopus/client-common/auth/session-token-store";
import type { Role } from "../router/auth-guard";
import { UNVERIFIED } from "../router/auth-guard";
import type { SessionCheck } from "../router/auth-guard";

/**
 * ログイン(管理者・参加者)のセッション状態。トークン自体は client-common の store に保持され、
 * APIクライアントが全RPCへ自動付与する。ここでは「今ログインしている人」を管理する。
 */
const currentMember = ref<Member | null>(null);
let restoring: Promise<void> | null = null;

/**
 * 保存済みトークンが有効か一度だけサーバーに確認する(例外で失敗したら次回また試す)。
 * サーバーが null を返したとき(期限切れ・追い出し・ログアウト済み・削除)だけトークンを消す。
 * 例外(通信エラー・タイムアウト・5xx・429)ではトークンを残す。
 */
function restoreSession(): Promise<void> {
  if (!restoring) {
    restoring = (async () => {
      const token = getSessionToken();
      if (!token) return;
      try {
        const member = await container.resolve(AccountsRepository).getSession(token, { retries: 0 });
        currentMember.value = member;
        if (!member) setSessionToken(null);
      } catch (e) {
        restoring = null;
        throw e;
      }
    })();
  }
  return restoring;
}

/** メンバーの役割。管理者フラグが無いメンバーは参加者。 */
export function roleOf(member: Member): Role {
  return member.isAdmin === true ? "admin" : "participant";
}

/** 今ログインしている人の役割。未ログインなら null、通信エラー等で確認できなければ UNVERIFIED(トークンは残る)。 */
export async function ensureRole(): Promise<SessionCheck> {
  try {
    await restoreSession();
  } catch {
    return UNVERIFIED;
  }
  return currentMember.value ? roleOf(currentMember.value) : null;
}

/** 管理者としてログインする。セッショントークンを保存し、ログイン中のメンバーを更新する。 */
export async function signIn(id: string, password: string): Promise<Member> {
  const { token, member } = await container.resolve(AccountsRepository).login(id, password);
  setSessionToken(token);
  currentMember.value = member;
  restoring = Promise.resolve();
  return member;
}

/** 受付QRのキーで参加者としてログインする。 */
export async function signInWithKey(id: string, key: string): Promise<Member> {
  const { token, member } = await container.resolve(AccountsRepository).loginWithKey(id, key);
  setSessionToken(token);
  currentMember.value = member;
  restoring = Promise.resolve();
  return member;
}

/** ログアウトする。端末のトークンを消してからサーバーのセッションも破棄する(サーバー側の失敗は無視)。 */
export async function signOut(): Promise<void> {
  const token = getSessionToken();
  setSessionToken(null);
  currentMember.value = null;
  restoring = Promise.resolve();
  if (!token) return;
  try {
    await container.resolve(AccountsRepository).logout(token);
  } catch {
    // サーバー側の失効に失敗しても、この端末のトークンは破棄済み
  }
}

/** 画面から使うログイン状態。ログイン中のメンバー(読み取り専用)・ログイン済みか・ログイン/ログアウトの操作。 */
export function useAuthSession() {
  return {
    currentMember: readonly(currentMember),
    isSignedIn: computed(() => currentMember.value !== null),
    signIn,
    signInWithKey,
    signOut,
  };
}
