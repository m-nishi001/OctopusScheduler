/**
 * 順位発表のあとの手順。結果を保存してから「発表が終わった」を公開する。
 *
 * 参加者のスマホは、finished を受け取ると結果を取りに行って自分の順位を出す。
 * 保存より先に公開すると、順位がまだ無いまま取りに行ってしまうので、必ず保存(失敗しても)のあとに公開する。
 * 保存は発表の演出と並行して先に始めておき、1位の祝福演出が始まる瞬間(onCelebrate)に公開する。
 * こうすると、ホストの「1位おめでとう」と参加者の「あなたはN位」がほぼ同時に出る。
 */
export interface ResultRevealSteps {
  /**
   * 順位発表の演出(1位の発表まで)。終わったら解決する。
   * 1位の祝福演出を始める瞬間に onCelebrate を呼ぶ(待たない)。
   */
  reveal(onCelebrate: () => void): Promise<void>;
  /** 参加者の「結果」に残す保存。 */
  record(): Promise<void>;
  /** 「発表が終わった」を公開する。 */
  publishFinished(): void;
  /** 画面を離れた(離れたあとは公開しない)。 */
  isDisposed(): boolean;
}

/**
 * 保存を先に始め、祝福演出の開始(当選者がいない時は発表の終わり)で、保存が済んでから
 * finished を公開する。保存に失敗しても公開まで進む。公開は一度だけ。
 */
export async function runResultRevealSequence(steps: ResultRevealSteps): Promise<void> {
  const recorded = steps.record().catch((e: unknown) => {
    console.error("Failed to record quiz result", e);
  });
  let publishing: Promise<void> | null = null;
  const publish = (): Promise<void> =>
    (publishing ??= recorded.then(() => {
      if (!steps.isDisposed()) steps.publishFinished();
    }));

  await steps.reveal(() => void publish());
  await publish();
}
