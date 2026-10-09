import { computed, readonly, ref } from "vue";
import { container } from "tsyringe";
import { AccountsRepository } from "@octopus/accounts";
import type { Member } from "@octopus/accounts";
import { getSessionToken, setSessionToken } from "@octopus/client-common/auth/session-token-store";

/**
 * 管理者ログインのセッション状態。トークン自体は client-common の store に保持され、
 * APIクライアントが全RPCへ自動付与する。ここでは「今ログインしている人」を管理する。
 */
const currentMember = ref<Member | null>(null);
let restoring: Promise<void> | null = null;

/** 保存済みトークンが有効か一度だけサーバーに確認する(失敗時は次回また試す)。 */
function restoreSession(): Promise<void> {
  if (!restoring) {
    restoring = (async () => {
      const token = getSessionToken();
      if (!token) return;
      try {
        const member = await container.resolve(AccountsRepository).getSession(token);
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

/** 管理者としてログイン済みか。通信エラー等で確認できない場合は false。 */
export async function ensureAdminSession(): Promise<boolean> {
  try {
    await restoreSession();
  } catch {
    return false;
  }
  return currentMember.value?.isAdmin === true;
}

export async function signIn(id: string, password: string): Promise<Member> {
  const { token, member } = await container.resolve(AccountsRepository).login(id, password);
  setSessionToken(token);
  currentMember.value = member;
  restoring = Promise.resolve();
  return member;
}

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

export function useAuthSession() {
  return {
    currentMember: readonly(currentMember),
    isSignedIn: computed(() => currentMember.value !== null),
    signIn,
    signOut,
  };
}
