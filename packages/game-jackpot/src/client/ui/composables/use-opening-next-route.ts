import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { useJackpotSession } from "./use-jackpot-session";

export const DESCRIPTION_ROUTE = "/jackpot-description";
export const ENTRY_ROUTE = "/jackpot-entry";

/**
 * オープニングの次の画面。セッションのホストとして接続していて、デモでないときだけ、共通のエントリー画面を挟む。
 * 単体の実行・デモ(リハーサル)・プレビューは、エントリーの相手がいないので説明へ進む。
 */
export function openingNextRoute(isHost: boolean, isDemo: boolean): string {
  return isHost && !isDemo ? ENTRY_ROUTE : DESCRIPTION_ROUTE;
}

/** オープニング画面で使う。必ずコンポーネントの setup() の同期実行中に呼ぶ。 */
export function useOpeningNextRoute(): string {
  const { isDemo } = useJackpotSession();
  const isHost = container.isRegistered(HostAgent) && container.resolve(HostAgent).active;
  return openingNextRoute(isHost, isDemo);
}
