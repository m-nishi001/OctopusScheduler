import { container, inject, singleton } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { getJackpotScope, type JackpotScope } from "../../model/jackpot-session";
import { MemberRepository } from "../../model/member/member-repository";
import { PrizeRepository } from "../../model/prize/prize-repository";
import type { DrawStore, DrawStoreSource } from "./draw-store";
import { RehearsalDrawStore } from "./rehearsal-draw-store";
import { SessionDrawStore } from "./session-draw-store";

/**
 * いまの実行に合った抽選状態の置き場を選ぶ。
 *  - セッションのホストとして接続していて、デモでない: セッションの結果ファイル(SessionDrawStore)
 *  - それ以外(セッションの外・デモ): メモリだけ(RehearsalDrawStore。実行スコープごとに1つ。画面を開き直すと消える)
 * メモリに読み込んだ内容を持ち続けるため、アプリで1つだけ(singleton)。
 */
@singleton()
export class DrawStoreProvider implements DrawStoreSource {
  private readonly rehearsals = new Map<JackpotScope, RehearsalDrawStore>();
  private session: SessionDrawStore | null = null;

  constructor(
    @inject(MemberRepository) private readonly members: MemberRepository,
    @inject(PrizeRepository) private readonly prizes: PrizeRepository
  ) {}

  current(): DrawStore {
    const scope = getJackpotScope();
    if (scope === "live" && container.isRegistered(HostAgent) && container.resolve(HostAgent).active) {
      this.session ??= new SessionDrawStore(() => container.resolve(HostAgent), {
        getMembers: () => this.members.getMembers(),
        getPrizes: () => this.prizes.getPrizes(),
      });
      return this.session;
    }
    return this.rehearsal(scope);
  }

  /** メモリだけの置き場(実行スコープごとに1つ)。管理画面が「リハーサル」の結果を見る・消すのに使う。 */
  rehearsal(scope: JackpotScope = getJackpotScope()): RehearsalDrawStore {
    let rehearsal = this.rehearsals.get(scope);
    if (!rehearsal) {
      rehearsal = new RehearsalDrawStore();
      this.rehearsals.set(scope, rehearsal);
    }
    return rehearsal;
  }
}
