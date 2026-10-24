import { container } from "tsyringe";
import { computed, type ComputedRef } from "vue";
import { HostAgent, readPortalEvent, useConnectionState } from "@octopus/session-hub";
import type { DrawPool } from "@octopus/session-hub";
import { useJackpotSession } from "./use-jackpot-session";

export const DESCRIPTION_ROUTE = "/jackpot-description";
export const ENTRY_ROUTE = "/jackpot-entry";

/**
 * オープニングの次の画面。セッションのホストとして接続していて、デモでなく、抽選の対象が「エントリーした人のみ」のときだけ、
 * 共通のエントリー画面を挟む。参加者全員(自動)は受付が要らないので説明へ進む。
 * 単体の実行・デモ(リハーサル)・プレビューは、エントリーの相手がいないので説明へ進む。
 */
export function openingNextRoute(isHost: boolean, isDemo: boolean, pool: DrawPool): string {
  return isHost && !isDemo && pool === "entrants" ? ENTRY_ROUTE : DESCRIPTION_ROUTE;
}

/** オープニング画面で使う。必ずコンポーネントの setup() の同期実行中に呼ぶ。管理端末で対象を切り替えると追従する。 */
export function useOpeningNextRoute(): ComputedRef<string> {
  const { isDemo } = useJackpotSession();
  if (!container.isRegistered(HostAgent)) return computed(() => openingNextRoute(false, isDemo, "auto"));
  const agent = container.resolve(HostAgent);
  const state = useConnectionState(agent.connection);
  return computed(() => openingNextRoute(agent.active, isDemo, readPortalEvent(state.value.roomState?.data)?.pool ?? "auto"));
}
