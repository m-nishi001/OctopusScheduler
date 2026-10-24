import { parseHubErrorCode, stripHubErrorCode } from "@octopus/session-hub";
import type { HostAgent, JackpotDraw, JackpotDrawInput } from "@octopus/session-hub";
import { DrawConflictError } from "../../model/errors";
import { fromMember } from "../member/dto/member-dto";
import type { Member } from "../../model/member/member";
import type { Prize } from "../../model/prize/prize";
import type { DrawPlan, DrawStore } from "./draw-store";
import type { DrawResultDto } from "./dto/draw-result-dto";

interface Row {
  result: DrawResultDto;
  revealed: boolean;
}

interface Snapshot {
  sessionId: string | null;
  plan: DrawPlan | null;
  rows: Row[];
}

/** サーバーに残るのは ID と名前だけなので、写真・演出などの詳細はホスト端末の設定から補う。 */
export interface DrawDirectory {
  getMembers(): Promise<Member[]>;
  getPrizes(): Promise<Prize[]>;
}

/**
 * セッションの結果ファイル(サーバー)を正本とする抽選状態。ホスト端末の HostAgent を通して読み書きする。
 * 読み込んだ内容はメモリに持ち、読み出しでは通信しない(GAS は1回の通信が重い)。
 * 通信するのは、読み込み(画面を開いたとき・矛盾が起きたとき)と、確変の予定の保存・commit・reveal・reset だけ。
 */
export class SessionDrawStore implements DrawStore {
  readonly kind = "session" as const;
  private snapshot: Snapshot | null = null;
  private loading: Promise<void> | null = null;
  /** 公開(reveal)の通信中のもの。同じ抽選の公開を重ねて送らない(通信中に次の抽選の前の後始末が来ても、その完了を待つだけにする)。 */
  private revealing = new Map<string, Promise<void>>();

  constructor(
    private readonly agent: () => HostAgent,
    private readonly directory: DrawDirectory
  ) {}

  private currentSessionId(): string | null {
    return this.agent().connection.state.session?.id ?? null;
  }

  private requireAgent(): HostAgent {
    const agent = this.agent();
    if (!agent.active) throw new Error("セッションに接続していないため、抽選の結果を保存できません");
    return agent;
  }

  /** 読み込み済みの内容を返す。まだ、または別のセッションに入り直していたら読み込む。 */
  private async ready(): Promise<Snapshot> {
    if (!this.snapshot || this.snapshot.sessionId !== this.currentSessionId()) await this.load();
    return this.snapshot!;
  }

  load(): Promise<void> {
    // 同時に何度呼ばれても、読み込みは1回にまとめる
    this.loading ??= this.fetch().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async fetch(): Promise<void> {
    const agent = this.requireAgent();
    const sessionId = this.currentSessionId();
    const [state, members, prizes] = await Promise.all([agent.getJackpotState(), this.directory.getMembers(), this.directory.getPrizes()]);
    const memberById = new Map(members.map((m) => [m.id, m]));
    const prizeById = new Map(prizes.map((p) => [p.id, p]));
    this.snapshot = {
      sessionId,
      plan: state.plan && { kakuhenTimings: [...state.plan.kakuhenTimings], reservedPrizeIds: [...state.plan.reservedPrizeIds] },
      rows: state.draws.map((d) => ({ result: toResult(d, memberById, prizeById), revealed: d.revealedAtMs !== null })),
    };
  }

  async results(): Promise<DrawResultDto[]> {
    return (await this.ready()).rows.map((r) => r.result);
  }

  async plan(): Promise<DrawPlan | null> {
    return (await this.ready()).plan;
  }

  async ensurePlan(kakuhenTimings: number[], reservedPrizeIds: string[]): Promise<DrawPlan> {
    const snapshot = await this.ready();
    const saved = await this.requireAgent().ensureJackpotPlan({ kakuhenTimings, reservedPrizeIds });
    snapshot.plan = { kakuhenTimings: saved.kakuhenTimings, reservedPrizeIds: saved.reservedPrizeIds };
    return snapshot.plan;
  }

  async commit(result: DrawResultDto): Promise<void> {
    const snapshot = await this.ready();
    const input = toInput(result);
    try {
      await this.requireAgent().commitJackpotDraw(input);
    } catch (e) {
      throw await this.translate(e);
    }
    if (!snapshot.rows.some((r) => r.result.drawId === result.drawId)) snapshot.rows.push({ result: { ...result }, revealed: false });
  }

  reveal(drawId: string): Promise<void> {
    const inflight = this.revealing.get(drawId);
    if (inflight) return inflight;
    const run = this.revealOnce(drawId).finally(() => this.revealing.delete(drawId));
    this.revealing.set(drawId, run);
    return run;
  }

  private async revealOnce(drawId: string): Promise<void> {
    const snapshot = await this.ready();
    try {
      await this.requireAgent().revealJackpotDraw(drawId);
    } catch (e) {
      throw await this.translate(e);
    }
    const row = snapshot.rows.find((r) => r.result.drawId === drawId);
    if (row) row.revealed = true;
  }

  async pending(): Promise<DrawResultDto | null> {
    return (await this.ready()).rows.find((r) => !r.revealed)?.result ?? null;
  }

  async reset(): Promise<void> {
    await this.requireAgent().resetJackpot();
    this.snapshot = { sessionId: this.currentSessionId(), plan: null, rows: [] };
  }

  /** 結果ファイルが受け付けなかった(JACKPOT_CONFLICT)ときは、状態を読み直してから DrawConflictError にする。 */
  private async translate(error: unknown): Promise<unknown> {
    const message = error instanceof Error ? error.message : String(error);
    if (parseHubErrorCode(message) !== "JACKPOT_CONFLICT") return error;
    await this.load().catch(() => {
      this.snapshot = null; // 読み直せなければ、次に使うときに読み直す
    });
    return new DrawConflictError(stripHubErrorCode(message));
  }
}

function toInput(result: DrawResultDto): JackpotDrawInput {
  if (!result.wonMember || !result.wonPrize) throw new Error("当選者と景品が決まっていない抽選結果は確定できません");
  return {
    drawId: result.drawId,
    memberId: result.wonMember.id,
    memberName: result.wonMember.name,
    prizeId: result.wonPrize.id,
    prizeName: result.wonPrize.name,
    isKakuhen: result.isKakuhen,
    atMs: result.createdAt,
  };
}

/** サーバーの行を、画面用の抽選結果にする。ホスト端末の設定に見つからない(消された)メンバー・景品は、サーバーに残る名前で代える。 */
function toResult(draw: JackpotDraw, members: Map<string, Member>, prizes: Map<string, Prize>): DrawResultDto {
  const member = members.get(draw.memberId);
  const prize = prizes.get(draw.prizeId);
  return {
    drawId: draw.drawId,
    wonMember: member ? fromMember(member) : { id: draw.memberId, name: draw.memberName, rank: 0 },
    wonPrize: prize ?? { id: draw.prizeId, name: draw.prizeName, order: 0 },
    isKakuhen: draw.isKakuhen,
    createdAt: draw.atMs,
  };
}
