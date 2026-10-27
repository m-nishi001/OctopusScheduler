import { onScopeDispose } from "vue";
import { container } from "tsyringe";
import { HostAgent, JACKPOT_NS } from "@octopus/session-hub";
import type { JackpotPublished } from "@octopus/session-hub";
import { JACKPOT_STOP_COMMAND } from "@model/jackpot-host-state";

export interface JackpotHostHandlers {
  /** 管理端末の「次へ」。本番画面の Enter キーと同じ進行。 */
  advance(): void;
  /** 管理端末の「前へ」。説明画面のスライドを1つ戻す。戻る操作が無い画面では渡さない。 */
  back?(): void;
  /** ルーレット/スロットを止める。管理端末、またはホストが許可した参加者から届く。 */
  stopRoulette(): void;
}

export interface JackpotHost {
  /** いまの抽選の状態を公開する。canStop の間だけ参加者のスマホに停止ボタンが出る。 */
  publish(state: JackpotPublished): void;
  /**
   * 進行のステップを実行し始めたときに呼ぶ。直前に公開した状態を、busy・止められない・参加者の操作なしで公開し直し、
   * 演出中に止める/進めるボタンが押せるまま残らないようにする。当選者・賞品は増やさない(ネタバレしない)。
   * まだ何も公開していなければ何もしない。
   */
  hold(): void;
}

const NAMESPACE = JACKPOT_NS;

/**
 * 本抽選画面(ホスト端末)で使う。セッションのホストとして接続している場合だけ、
 * 管理端末/参加者からの jackpot.* コマンドを受け付け、抽選の状態を公開する。
 * ホストとして接続していない端末(単独で動かしている場合)では何もしない。
 *
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ(コンポーネントの破棄時に後片付けを登録するため)。
 */
export function useJackpotHost(handlers: JackpotHostHandlers): JackpotHost {
  if (!container.isRegistered(HostAgent)) return { publish: () => undefined, hold: () => undefined };
  const agent = container.resolve(HostAgent);
  let canStop = false;
  let last: JackpotPublished | null = null;

  const off = agent.router.register(NAMESPACE, (command) => {
    switch (command.type) {
      case "advance":
        handlers.advance();
        break;
      case "back":
        handlers.back?.();
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
      last = state;
      if (state.page === "description") {
        canStop = false;
        void agent.publishSlice(NAMESPACE, state, []);
        return;
      }
      canStop = state.canStop;
      // メンバー抽選は管理者が進行する。景品抽選の停止は、当選した本人だけが送れる(宛先を当選者に絞る。管理者は常に可)。
      const winnerId = state.canStop && state.stage === "prize" ? state.memberId : null;
      void agent.publishSlice(NAMESPACE, state, winnerId ? [{ key: JACKPOT_STOP_COMMAND, memberIds: [winnerId] }] : []);
    },
    hold() {
      if (!last) return;
      canStop = false;
      last = { ...last, busy: true, canStop: false };
      void agent.publishSlice(NAMESPACE, last, []);
    }
  };
}
