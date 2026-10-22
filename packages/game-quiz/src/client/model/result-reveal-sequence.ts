/**
 * 順位発表のあとの手順。結果を保存してから「発表が終わった」を公開する。
 *
 * 参加者のスマホは、finished を受け取ると結果を取りに行って自分の順位を出す。
 * 保存より先に公開すると、順位がまだ無いまま取りに行ってしまうので、必ず保存(失敗しても)のあとに公開する。
 */
export interface ResultRevealSteps {
  /** 順位発表の演出(1位の発表まで)。終わったら解決する。 */
  reveal(): Promise<void>;
  /** 参加者の「結果」に残す保存。 */
  record(): Promise<void>;
  /** 「発表が終わった」を公開する。 */
  publishFinished(): void;
  /** 画面を離れた(離れたあとは公開しない)。 */
  isDisposed(): boolean;
}

/** 発表 → 保存 → 「発表が終わった」の公開、の順に進める。保存に失敗しても公開まで進む。 */
export async function runResultRevealSequence(steps: ResultRevealSteps): Promise<void> {
  await steps.reveal();
  try {
    await steps.record();
  } catch (e) {
    console.error("Failed to record quiz result", e);
  }
  if (!steps.isDisposed()) steps.publishFinished();
}
