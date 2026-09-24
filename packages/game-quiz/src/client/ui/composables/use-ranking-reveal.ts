import { ref, type Ref } from 'vue';

export interface RankingRevealTiming {
  /** 4位以下を1件ずつ表示する間隔(ms)。 */
  otherPlacesIntervalMs?: number;
  /** 4位以下の表示が終わってから、上位3位の表示を始めるまでの間(ms)。 */
  beforeTopPauseMs?: number;
  /** 上位3位を1件ずつ表示する間隔(ms)。 */
  topPlaceIntervalMs?: number;
  /** 1位の演出(紙吹雪等)を表示しておく時間(ms)。 */
  celebrationDurationMs?: number;
}

/**
 * ランキング発表画面の「下位から順に積み上がる」演出タイミングを管理するcomposable。
 * 4位以下を1件ずつ下から積み上げ、間を置いて上位3位を1件ずつ発表し、1位の発表と
 * 同時に祝福演出(showCelebration)を一定時間だけ有効にする。演出が完了すると
 * isFinishedがtrueになり、呼び出し側はこれをもって次の操作(Enterで賞品発表など)を
 * 許可できる。
 */
export function useRankingReveal<T>(timing: RankingRevealTiming = {}) {
  const {
    otherPlacesIntervalMs = 500,
    beforeTopPauseMs = 1000,
    topPlaceIntervalMs = 1000,
    celebrationDurationMs = 3000,
  } = timing;

  const displayedResults = ref<T[]>([]) as Ref<T[]>;
  const showCelebration = ref(false);
  const isFinished = ref(false);

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** rank(1始まり)昇順に並んだ結果配列を渡して演出を開始する。 */
  async function reveal(rankedResults: readonly T[]): Promise<void> {
    displayedResults.value = [];
    showCelebration.value = false;
    isFinished.value = false;

    // 最下位から順に上に積み上がるように表示する(4位以下)
    for (let i = rankedResults.length - 1; i >= 3; i--) {
      const item = rankedResults[i];
      if (item) {
        displayedResults.value.unshift(item);
        await wait(otherPlacesIntervalMs);
      }
    }

    // 上位3位は特別扱い: 間を置いてから、3位→1位の順に発表する
    await wait(beforeTopPauseMs);
    const topCount = Math.min(3, rankedResults.length);
    let celebrated = false;
    for (let j = topCount - 1; j >= 0; j--) {
      const item = rankedResults[j];
      if (item) {
        displayedResults.value.unshift(item);
        await wait(topPlaceIntervalMs);
        if (j === 0) {
          showCelebration.value = true;
          setTimeout(() => {
            showCelebration.value = false;
          }, celebrationDurationMs);
          celebrated = true;
        }
      }
    }

    // 祝福演出が終わるのを待ってからEnter操作を許可する
    if (celebrated) {
      await wait(celebrationDurationMs);
    }
    isFinished.value = true;
  }

  return { displayedResults, showCelebration, isFinished, reveal };
}
