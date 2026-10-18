import { onScopeDispose, ref, watch } from "vue";
import type { Ref } from "vue";
import type { RoundAnswer } from "../../shared/protocol";
import type { ConnectionState, SessionConnection } from "../model/session-connection";

/** 一覧を取り直す最短の間隔。エントリーが殺到しても、運営端末の取得は毎秒1回までに抑える（無料枠の保護）。 */
export const MIN_ANSWERS_REFRESH_MS = 1_500;

export interface RoundAnswers {
  /** 回答の一覧（受け付けた順）。サーバーが1人1件にそろえている（選び直した人は最後の選択）。 */
  answers: Ref<RoundAnswer[]>;
  /** サーバー側の回答数（一覧の取得を待たずに、更新の通知で分かる最新の数）。 */
  count: Ref<number>;
  /** 直近の取得の失敗。成功したら null。失敗しても自動では再試行しない（次の回答数の変化で取り直す）。 */
  error: Ref<string | null>;
  /** いますぐ取り直す。 */
  refresh(): Promise<void>;
}

export interface RoundAnswersOptions {
  minIntervalMs?: number;
  now?: () => number;
}

/**
 * 運営端末（ホスト/管理）が、回答ラウンドの回答の一覧をリアルタイムに見る。
 * 回答の変化（回答数、または選び直しの更新番号。更新の通知で届く）をきっかけにだけ一覧を取りに行くので、定期的な問い合わせはしない。
 * 取得は最短 MIN_ANSWERS_REFRESH_MS 間隔にまとめる（先頭の1回はすぐ、続く変化は間隔をあけて1回に）。
 */
export function useRoundAnswers(
  connection: Pick<SessionConnection, "getAnswers">,
  state: Ref<ConnectionState>,
  key: Ref<string | null>,
  options: RoundAnswersOptions = {}
): RoundAnswers {
  const minIntervalMs = options.minIntervalMs ?? MIN_ANSWERS_REFRESH_MS;
  const now = options.now ?? (() => Date.now());
  const answers = ref<RoundAnswer[]>([]);
  const count = ref(0);
  const error = ref<string | null>(null);

  let fetchedRev = -1;
  let lastFetchAt = Number.NEGATIVE_INFINITY;
  let inFlight = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  async function fetchNow(): Promise<void> {
    const current = key.value;
    if (!current) return;
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    lastFetchAt = now();
    const mine = generation;
    try {
      const result = await connection.getAnswers(current);
      // 取得中に受付（key）が変わっていたら捨てる
      if (mine === generation) {
        answers.value = result.answers;
        count.value = result.round.answerCount;
        fetchedRev = result.round.answerRev;
        error.value = null;
      }
    } catch (e) {
      if (mine === generation) error.value = e instanceof Error ? e.message : String(e);
    } finally {
      inFlight = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  }

  function schedule(): void {
    if (!key.value || timer) return;
    const wait = Math.max(0, lastFetchAt + minIntervalMs - now());
    if (wait === 0) {
      void fetchNow();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void fetchNow();
    }, wait);
  }

  // 受付（key）が変わったら一覧を空にして取り直す。回答数が変わったら取り直す。
  const stopKey = watch(
    key,
    () => {
      generation++;
      answers.value = [];
      count.value = 0;
      fetchedRev = -1;
      error.value = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastFetchAt = Number.NEGATIVE_INFINITY;
      schedule();
    },
    { immediate: true }
  );
  // 回答数または更新番号が変わったときだけ動く(更新の通知のたびに新しい round オブジェクトが届くので、値で比べる)
  const stopCount = watch(
    () => {
      const round = state.value.round;
      return round && round.key === key.value ? `${round.answerCount}:${round.answerRev}` : null;
    },
    (next) => {
      const round = state.value.round;
      if (next === null || !round) return;
      count.value = round.answerCount;
      // 取得済みの内容と同じなら、取り直さない(自分の取得で追いついた場合)
      if (round.answerRev !== fetchedRev || round.answerCount !== answers.value.length) schedule();
    }
  );

  onScopeDispose(() => {
    stopKey();
    stopCount();
    generation++;
    if (timer) clearTimeout(timer);
  });

  return { answers, count, error, refresh: fetchNow };
}
