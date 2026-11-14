import { container, inject, singleton } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { getJackpotScope, isDemoDrawScreen, type JackpotScope } from "../../model/jackpot-session";
import { MemberRepository } from "../../model/member/member-repository";
import { JackpotRepository } from "../../model/jackpot-repository";
import type { DrawStore, DrawStoreSource } from "./draw-store";
import { RehearsalDrawStore } from "./rehearsal-draw-store";
import { SessionDrawStore } from "./session-draw-store";

/**
 * いまの実行に合った抽選状態の置き場を選ぶ。
 *  - セッションのホストとして接続していて、デモでない: セッションの結果ファイル(SessionDrawStore)
 *  - デモ抽選(練習抽選)の画面: 接続の有無にかかわらず、メモリだけの専用の置き場(本番の結果にも、デモの実行の結果にも混ざらない)
 *  - それ以外(セッションの外・デモ): メモリだけ(RehearsalDrawStore。実行スコープごとに1つ。画面を開き直すと消える)
 * メモリに読み込んだ内容を持ち続けるため、アプリで1つだけ(singleton)。
 */
@singleton()
export class DrawStoreProvider implements DrawStoreSource {
  private readonly rehearsals = new Map<JackpotScope | "demo-draw", RehearsalDrawStore>();
  private session: SessionDrawStore | null = null;

  constructor(
    @inject(MemberRepository) private readonly members: MemberRepository,
    @inject(JackpotRepository) private readonly prizes: JackpotRepository
  ) {}

  current(): DrawStore {
    if (isDemoDrawScreen()) return this.rehearsal("demo-draw");
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
  rehearsal(scope: JackpotScope | "demo-draw" = getJackpotScope()): RehearsalDrawStore {
    let rehearsal = this.rehearsals.get(scope);
    if (!rehearsal) {
      rehearsal = new RehearsalDrawStore();
      this.rehearsals.set(scope, rehearsal);
    }
    return rehearsal;
  }
}
