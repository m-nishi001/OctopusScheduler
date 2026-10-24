import { computed, inject, ref, watch } from "vue";
import type { ComputedRef, InjectionKey, Ref } from "vue";
import { ENTRY_OPTION_NO, parseHubErrorCode } from "@octopus/session-hub";
import type { PortalEvent } from "@octopus/session-hub";
import type { PortalSession } from "./use-portal-session";

/**
 * none  : このイベントにエントリー受付は無い（まだ始まっていない）
 * open  : 受付中
 * closed: 受付を締め切った
 */
export type EntryPhase = "none" | "open" | "closed";

export interface EntryStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

function browserStorage(): EntryStorage {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // 保存できなくても、エントリー自体は有効（リロード後の「済み」表示が遅れるだけ）
      }
    },
  };
}

/**
 * エントリーしなくても抽選の対象になるイベントか（抽選の対象が「自動」）。
 * 対象の方式が決まっていない（pool が無い）イベントは、まだ受付前なので自動とは扱わない。
 */
export function isAutoEntered(event: Pick<PortalEvent, "pool"> | null | undefined): boolean {
  return !!event && event.pool === "auto";
}

export const ENTRY_KEY: InjectionKey<EntryState> = Symbol("portalEntry");

/** レイアウトが提供するエントリーの状態を取り出す。レイアウトの外で使うと例外にする。 */
export function useEntryContext(): EntryState {
  const entry = inject(ENTRY_KEY, null);
  if (!entry) throw new Error("PortalLayout の中で使ってください");
  return entry;
}

export interface EntryState {
  phase: ComputedRef<EntryPhase>;
  /** 自分がエントリー済みか（この端末で押した、または別の端末で済みと返された）。 */
  entered: Ref<boolean>;
  /** 抽選の対象が「自動」で、エントリーしなくても対象になっている。 */
  autoEntered: ComputedRef<boolean>;
  /** エントリー済み、または自動エントリー（画面に「エントリー済み」を出す条件）。 */
  isIn: ComputedRef<boolean>;
  submitting: Ref<boolean>;
  /** 直近の操作の結果として見せる案内（失敗時など）。 */
  message: Ref<string>;
  enter(): Promise<void>;
}

/**
 * イベントのエントリー（参加受付）。受付中に押すと回答ラウンドに回答し、サーバー側で1人1回に数えられる。
 * エントリー済みはブラウザに（メンバーごとに）保存し、リロードしても「済み」の表示が残る。
 * 受付を締め切った/再開したは、ホストが公開するイベントの状態（entry.open）で全員の画面に反映される。
 */
export interface EntryOptions {
  /** ログイン中のメンバーID。「済み」の保存を人ごとに分ける（1台のスマホを何人かで使っても取り違えない）。 */
  memberId: () => string | null;
  storage?: EntryStorage;
}

/** イベントのエントリー(参加受付)。受付中に押すと回答ラウンドに回答し、サーバー側で1人1回に数える。エントリー済みはメンバーごとに端末に保存する。 */
export function useEntry(session: PortalSession, options: EntryOptions): EntryState {
  const storage = options.storage ?? browserStorage();
  const entry = computed(() => session.event.value?.entry ?? null);
  const phase = computed<EntryPhase>(() => (!entry.value ? "none" : entry.value.open ? "open" : "closed"));
  const storageKey = computed(() => {
    const sessionId = session.state.value.session?.id;
    const memberId = options.memberId();
    return sessionId && memberId && entry.value ? `octopus.entry:${memberId}:${sessionId}:${entry.value.key}` : null;
  });

  const autoEntered = computed(() => isAutoEntered(session.event.value));
  const entered = ref(false);
  const isIn = computed(() => entered.value || autoEntered.value);
  const submitting = ref(false);
  const message = ref("");

  // 受付（key）が変わったら、保存してある「済み」を読み直す
  watch(
    storageKey,
    (key) => {
      message.value = "";
      entered.value = key ? storage.get(key) === "1" : false;
    },
    { immediate: true }
  );

  async function enter(): Promise<void> {
    const current = entry.value;
    if (!current || !current.open || isIn.value || submitting.value) return;
    submitting.value = true;
    message.value = "";
    try {
      // 重複（別の端末で済み・連打）でも「エントリー済み」として扱う
      await session.answer(current.key, ENTRY_OPTION_NO);
      entered.value = true;
      const key = storageKey.value;
      if (key) storage.set(key, "1");
    } catch (error) {
      const code = parseHubErrorCode(error instanceof Error ? error.message : "");
      message.value =
        code === "ROUND_CLOSED" || code === "ROUND_NOT_OPEN"
          ? "エントリーの受付は終了しました。"
          : "通信できませんでした。電波の良い場所で、もう一度押してください。";
    } finally {
      submitting.value = false;
    }
  }

  return { phase, entered, autoEntered, isIn, submitting, message, enter };
}
