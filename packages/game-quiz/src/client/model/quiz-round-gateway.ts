import { container } from "tsyringe";
import { HostAgent, SessionAdminRepository } from "@octopus/session-hub";
import type { QuizSessionScope } from "../../server/quiz-api-contract";
import type { QuizHostState } from "./quiz-host-state";
import { roundKeyFor } from "./quiz-host-state";
import type { RankingAnswer } from "./ranking";

export interface OpenedRound {
  key: string;
  /** 締切(サーバ時刻 ms)。ホストはこれを公開し、参加者の残り時間もこれで揃える。 */
  deadlineMs: number;
  /** 開始時点の残り時間(ms)。端末の時計に依存しないよう、サーバ時刻どうしの差で出す。 */
  remainingMs: number;
}

export interface RoundAnswers {
  answers: RankingAnswer[];
  /** 受付を開始した時刻(サーバ時刻 ms)。順位の「回答までの秒数」の基準。 */
  openedAtMs: number;
}

const NAMESPACE = "quiz";

/**
 * クイズの回答受付(参加者の回答の収集)と、ホスト/管理/参加者への状態公開の窓口。
 *
 * この端末がセッションのホストとして接続している場合だけ動き、そうでなければ何もしない
 * (単独で表示だけ行っている場合も画面は壊れないが、参加者の回答は集まらない)。
 * 回答の締切・先着判定・集計の元データはセッション基盤(サーバ側)が持つので、
 * ホストのタブが落ちても受付は締切時刻で自動的に終わる。
 */
export class QuizRoundGateway {
  private agent(): HostAgent | null {
    return container.isRegistered(HostAgent) ? container.resolve(HostAgent) : null;
  }

  /** セッションのホストとして接続しているか。 */
  isActive(): boolean {
    return this.agent()?.active === true;
  }

  async open(
    quizId: string,
    scope: QuizSessionScope,
    options: Array<{ no: number; text: string }>,
    timeLimitSec: number
  ): Promise<OpenedRound | null> {
    const agent = this.agent();
    if (!agent?.active) return null;
    const key = roundKeyFor(quizId, scope);
    const result = await agent.connection.openRound(
      key,
      options.map((o) => ({ no: o.no, text: o.text.slice(0, 100) })),
      Math.max(1, Math.round(timeLimitSec)) * 1000
    );
    return { key, deadlineMs: result.deadlineMs, remainingMs: result.deadlineMs - result.serverNowMs };
  }

  async close(quizId: string, scope: QuizSessionScope): Promise<void> {
    const agent = this.agent();
    if (!agent?.active) return;
    await agent.connection.closeRound(roundKeyFor(quizId, scope));
  }

  /** 回答の一覧。ラウンドが無い/ホストでない場合は null(順位は「正答者なし」になる)。 */
  async answers(quizId: string, scope: QuizSessionScope): Promise<RoundAnswers | null> {
    const agent = this.agent();
    if (!agent?.active) return null;
    try {
      const result = await agent.connection.getAnswers(roundKeyFor(quizId, scope));
      return {
        openedAtMs: result.round.openedAtMs,
        answers: result.answers.map((a) => ({
          userId: a.memberId ?? a.deviceId,
          displayName: a.label,
          optionNo: a.no,
          serverTimestampMs: a.atMs,
        })),
      };
    } catch (e) {
      console.error("Failed to load answers", e);
      return null;
    }
  }

  publish(state: QuizHostState): void {
    const agent = this.agent();
    if (agent?.active) void agent.publishSlice(NAMESPACE, state);
  }

  clear(): void {
    const agent = this.agent();
    if (agent) void agent.clearSlice(NAMESPACE);
  }

  /** 参加者がQRから開くポータルのURL(セッションの参加コード入り)。ホストでなければ null。 */
  async portalUrl(): Promise<{ url: string; code: string } | null> {
    const agent = this.agent();
    const code = agent?.active ? agent.connection.state.session?.code : null;
    if (!code || !container.isRegistered(SessionAdminRepository)) return null;
    return { url: await container.resolve(SessionAdminRepository).portalUrl(code), code };
  }

  /** ホストとして接続中のセッションの参加コード。 */
  sessionCode(): string | null {
    const agent = this.agent();
    return agent?.active ? agent.connection.state.session?.code ?? null : null;
  }
}
