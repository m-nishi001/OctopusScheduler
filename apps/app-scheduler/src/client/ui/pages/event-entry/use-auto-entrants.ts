import { onUnmounted, ref, watch } from "vue";
import type { Ref } from "vue";
import { container } from "tsyringe";
import { AccountsRepository } from "@octopus/accounts";
import type { HostAgent } from "@octopus/session-hub";

export interface AutoEntrant {
  memberId: string;
  name: string;
}

/** 名簿が変わらなくても取り直す間隔(ミリ秒)。入室の通知(presence)を取りこぼしたときの保険。 */
export const AUTO_ENTRANTS_REFRESH_MS = 10_000;

export interface AutoEntrantsOptions {
  agent: HostAgent;
  /** 取り込むか(自動のときだけ true)。false の間は何も読まず、何も書かない。 */
  active: Ref<boolean>;
  /** 参加者の数が変わったことを知らせる値(presence.clientCount)。変わったら取り直す。 */
  signal: Ref<number>;
  refreshMs?: number;
}

/**
 * 「参加者全員(自動)」のとき、自動でエントリーされている人(今日ポータルから参加した管理者以外のメンバー)を取得する。
 * 読み取りだけで、サーバーへの書き込みは無い。管理者は `listAccounts().isAdmin` で除く。
 * 取得に失敗したときは、直前の一覧を残す(管理者を除けない一覧を出さない)。
 */
export function useAutoEntrants(options: AutoEntrantsOptions): { entrants: Ref<AutoEntrant[]>; refresh: () => Promise<void> } {
  const entrants = ref<AutoEntrant[]>([]);
  let accounts = new Map<string, { name: string; isAdmin: boolean }>();
  let running: Promise<void> | null = null;
  let again = false;
  let disposed = false;

  const load = async (): Promise<void> => {
    const { memberIds } = await options.agent.listParticipants();
    if (memberIds.some((id) => !accounts.has(id))) {
      const members = await container.resolve(AccountsRepository).listAccounts();
      accounts = new Map(members.map((m) => [m.id, { name: m.name, isAdmin: !!m.isAdmin }]));
    }
    if (disposed || !options.active.value) return;
    entrants.value = [...new Set(memberIds)]
      .filter((id) => !accounts.get(id)?.isAdmin)
      .map((id) => ({ memberId: id, name: accounts.get(id)?.name ?? id }));
  };

  /** 同時に1回だけ読む。読んでいる最中に呼ばれたら、終わったあともう1回読む。 */
  const refresh = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          try {
            await load();
          } catch (error) {
            console.warn("自動エントリーの参加者を取得できませんでした", error);
          }
        } while (again && !disposed && options.active.value);
      } finally {
        running = null;
      }
    })();
    return running;
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = (): void => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  watch(
    options.active,
    (on) => {
      stop();
      if (!on) return;
      void refresh();
      timer = setInterval(() => void refresh(), options.refreshMs ?? AUTO_ENTRANTS_REFRESH_MS);
    },
    { immediate: true },
  );
  watch(options.signal, () => {
    if (options.active.value) void refresh();
  });
  onUnmounted(() => {
    disposed = true;
    stop();
  });

  return { entrants, refresh };
}
