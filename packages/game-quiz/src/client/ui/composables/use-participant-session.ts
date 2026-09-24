import { ref } from "vue";
import { container } from "tsyringe";
import { useLocalStorage } from "@octopus/composables";
import { LoginParticipantUseCase } from "../../control/use-cases/login-participant-use-case";
import { ResolveDeviceTokenUseCase } from "../../control/use-cases/resolve-device-token-use-case";
import type { ParticipantSession } from "../../../server/quiz-api-contract";

const DEVICE_TOKEN_ID = "device-token";

export interface ParticipantSessionStorage {
  get<T>(id: string): Promise<T | undefined>;
  save<T>(id: string, value: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface UseParticipantSessionDeps {
  loginUseCase: Pick<LoginParticipantUseCase, "execute">;
  resolveUseCase: Pick<ResolveDeviceTokenUseCase, "execute">;
  storage: ParticipantSessionStorage;
}

/**
 * 参加者の端末ログイン状態を管理するcomposable。
 * 初回はユーザーIDでログインしてトークンを発行、以降は端末に保存した
 * トークンで自動的にログイン状態を復元する(毎回のユーザーID入力を省略)。
 * 依存はテストで差し替えられるよう引数として受け取れるようにしている
 * (省略時は実際のDIコンテナ/localStorageを使う)。
 */
export function useParticipantSession(deps?: Partial<UseParticipantSessionDeps>) {
  const session = ref<ParticipantSession | null>(null);
  const isRestoring = ref(true);
  const isLoggingIn = ref(false);
  const loginError = ref<string | null>(null);

  const localStorage = useLocalStorage("quiz-game", "ParticipantSession");
  const storage: ParticipantSessionStorage = deps?.storage ?? {
    get: localStorage.get,
    save: localStorage.save,
    remove: localStorage.remove,
  };
  const loginUseCase = deps?.loginUseCase ?? container.resolve(LoginParticipantUseCase);
  const resolveUseCase = deps?.resolveUseCase ?? container.resolve(ResolveDeviceTokenUseCase);

  async function restore(): Promise<void> {
    isRestoring.value = true;
    try {
      const token = await storage.get<string>(DEVICE_TOKEN_ID);
      if (!token) {
        session.value = null;
        return;
      }
      session.value = await resolveUseCase.execute(token);
    } catch {
      // 失効・不正なトークンは破棄して再ログインを促す
      await storage.remove(DEVICE_TOKEN_ID);
      session.value = null;
    } finally {
      isRestoring.value = false;
    }
  }

  async function login(userId: string): Promise<void> {
    isLoggingIn.value = true;
    loginError.value = null;
    try {
      const result = await loginUseCase.execute(userId);
      await storage.save(DEVICE_TOKEN_ID, result.token);
      session.value = result;
    } catch (e) {
      loginError.value = e instanceof Error ? e.message : String(e);
    } finally {
      isLoggingIn.value = false;
    }
  }

  return { session, isRestoring, isLoggingIn, loginError, restore, login };
}
