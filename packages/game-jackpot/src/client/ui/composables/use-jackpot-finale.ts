import { onMounted } from "vue";
import { buildJackpotFinaleState } from "@model/jackpot-host-state";
import { useJackpotHost } from "./use-jackpot-host";

/**
 * 結果・エンディングの画面(ホスト端末)で使う。画面が出たら「終了の場面」を公開し、参加者のポータルが
 * エントリーカードではなく終了の画面を出せるようにする。画面を離れると公開は取り下げられる。
 * 進行はこれらの画面自身(Enter・管理端末の画面遷移)が行うので、管理端末の進める/止めるには反応しない。
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ。
 */
export function useJackpotFinale(): void {
  const host = useJackpotHost({ advance: () => undefined, stopRoulette: () => undefined });
  onMounted(() => host.publish(buildJackpotFinaleState()));
}
