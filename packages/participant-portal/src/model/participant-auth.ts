import { inject } from "vue";
import type { InjectionKey, Ref } from "vue";

/**
 * ポータルが必要とするログイン情報。アプリ本体が提供する(ログインの実装はアプリ側にあり、
 * このパッケージはアプリに依存しない)。アプリの起動時に `app.provide(PARTICIPANT_AUTH_KEY, …)` する。
 */
export interface ParticipantAuth {
  currentMember: Readonly<Ref<{ id: string; name: string } | null>>;
  signOut(): Promise<void>;
}

export const PARTICIPANT_AUTH_KEY: InjectionKey<ParticipantAuth> = Symbol("participantAuth");

export function useParticipantAuth(): ParticipantAuth {
  const auth = inject(PARTICIPANT_AUTH_KEY, null);
  if (!auth) throw new Error("PARTICIPANT_AUTH_KEY が提供されていません(アプリの起動時に app.provide してください)");
  return auth;
}
