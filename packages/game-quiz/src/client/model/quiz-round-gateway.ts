import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import type { QuizRoundResult } from "@octopus/session-hub";
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
          memberId: a.memberId ?? null,
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

  /**
   * このラウンドの結果を保存して、参加者のポータルへ知らせる。失敗しても演出は止めず、数回だけ再試行する。
   * ホストとして接続していなければ何もしない。保存できたら true。
   */
  async recordResult(
    result: QuizRoundResult,
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
  ): Promise<boolean> {
    const agent = this.agent();
    if (!agent?.active) return false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await agent.recordQuizResult(result);
        return true;
      } catch (e) {
        if (attempt === 3) console.error("Failed to record quiz result", e);
        else await sleep(1000 * attempt);
      }
    }
    return false;
  }

  publish(state: QuizHostState): void {
    const agent = this.agent();
    if (agent?.active) void agent.publishSlice(NAMESPACE, state);
  }

  clear(): void {
    const agent = this.agent();
    if (agent) void agent.clearSlice(NAMESPACE);
  }
}
