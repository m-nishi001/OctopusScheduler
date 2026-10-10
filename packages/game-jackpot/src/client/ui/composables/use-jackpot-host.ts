import { onScopeDispose } from "vue";
import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { JACKPOT_STOP_COMMAND } from "@model/jackpot-host-state";
import type { JackpotHostState } from "@model/jackpot-host-state";

export interface JackpotHostHandlers {
  /** 管理端末の「次へ」。本番画面の Enter キーと同じ進行。 */
  advance(): void;
  /** ルーレット/スロットを止める。管理端末、またはホストが許可した参加者から届く。 */
  stopRoulette(): void;
}

export interface JackpotHost {
  /** いまの抽選の状態を公開する。canStop の間だけ参加者のスマホに停止ボタンが出る。 */
  publish(state: JackpotHostState): void;
}

const NAMESPACE = "jackpot";

/**
 * 本抽選画面(ホスト端末)で使う。セッションのホストとして接続している場合だけ、
 * 管理端末/参加者からの jackpot.* コマンドを受け付け、抽選の状態を公開する。
 * ホストとして接続していない端末(単独で動かしている場合)では何もしない。
 *
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ(コンポーネントの破棄時に後片付けを登録するため)。
 */
export function useJackpotHost(handlers: JackpotHostHandlers): JackpotHost {
  if (!container.isRegistered(HostAgent)) return { publish: () => undefined };
  const agent = container.resolve(HostAgent);
  let canStop = false;

  const off = agent.router.register(NAMESPACE, (command) => {
    switch (command.type) {
      case "advance":
        handlers.advance();
        break;
      case "stopRoulette":
        // 止められる場面でだけ受け付ける。参加者の押下が遅れて届いても、次の場面を誤って進めない。
        if (canStop) handlers.stopRoulette();
        break;
      default:
        break;
    }
  });

  onScopeDispose(() => {
    off();
    void agent.clearSlice(NAMESPACE);
  });

  return {
    publish(state) {
      canStop = state.canStop;
      void agent.publishSlice(NAMESPACE, state, state.canStop ? [JACKPOT_STOP_COMMAND] : []);
    },
  };
}
