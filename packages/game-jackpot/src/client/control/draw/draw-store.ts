import type { DrawResultDto } from "./dto/draw-result-dto";

/**
 * 確変の予定。セッションで最初に決めたものを以後は変えない。
 * - kakuhenTimings: 確変にする抽選の順番(確定済みの件数 + 1 を基準にした何回目か)
 * - reservedPrizeIds: 確変のために取り置いた景品。通常の抽選では当たらない
 */
export interface DrawPlan {
  kakuhenTimings: number[];
  reservedPrizeIds: string[];
}

/**
 * 抽選の状態(当選者・景品の在庫・確変の予定)の置き場の窓口。
 * 実装は2つ:
 *  - SessionDrawStore: セッションの結果ファイル(サーバー)が正本。同じセッションの中では、イベントを跨いでも同じ人・同じ景品は二度当たらない。
 *  - RehearsalDrawStore: メモリだけ(セッションの外の実行・デモ)。画面を開き直すと消える。
 *
 * 読み出し(results / plan / pending)は、読み込んだ内容をメモリから返す(通信しない)。
 * 通信するのは load / ensurePlan / commit / reveal / reset だけ。
 */
export interface DrawStore {
  /** 保存先が結果を残すか。rehearsal のときは画面に「リハーサル」と出す。 */
  readonly kind: "session" | "rehearsal";
  /** 保存先から最新の状態を読み直す(抽選画面を開いたとき・矛盾が起きたとき)。 */
  load(): Promise<void>;
  /** 確定済みの抽選(未公開を含む)。古い順。 */
  results(): Promise<DrawResultDto[]>;
  /** 確変の予定。まだ決めていなければ null。 */
  plan(): Promise<DrawPlan | null>;
  /** 確変の予定を、まだ無ければ保存する。返るのは保存されている予定(先に保存されたものが勝つ)。 */
  ensurePlan(kakuhenTimings: number[], reservedPrizeIds: string[]): Promise<DrawPlan>;
  /**
   * 抽選結果を未公開で確定する。演出を始める前に呼び、成功してから演出する。
   * 当選済みのメンバー・景品、公開されていない別の結果などは DrawConflictError(状態は読み直し済み)。
   * 同じ内容の再送は成功。
   */
  commit(result: DrawResultDto): Promise<void>;
  /** 確定済みの抽選を公開する(当選者と景品が画面に見えた時点)。何度呼んでも同じ。知らない drawId は DrawConflictError。 */
  reveal(drawId: string): Promise<void>;
  /** 確定済みだが公開されていない抽選(ホストの再読み込みなどで演出が途中だったもの)。無ければ null。 */
  pending(): Promise<DrawResultDto | null>;
  /** 抽選の結果と確変の予定を消す。 */
  reset(): Promise<void>;
}

/** いまの実行環境に合った DrawStore を返す。 */
export interface DrawStoreSource {
  current(): DrawStore;
}
