import { onScopeDispose, ref, watch } from "vue";
import type { Ref } from "vue";
import type { RoundAnswer } from "../../shared/protocol";
import type { ConnectionState, SessionConnection } from "../model/session-connection";

/** 一覧を取り直す最短の間隔。エントリーが殺到しても、運営端末の取得は毎秒1回までに抑える（無料枠の保護）。 */
export const MIN_ANSWERS_REFRESH_MS = 1_500;

export interface RoundAnswers {
  /** 回答の一覧（受け付けた順）。ログインから確定したメンバーは1人1件にそろえる。 */
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

/** ログインから確定したメンバーは先着1件にそろえる（匿名の申告は端末ごとにそのまま残す）。 */
export function uniqueAnswers(answers: RoundAnswer[]): RoundAnswer[] {
  const seen = new Set<string>();
  const out: RoundAnswer[] = [];
  for (const a of [...answers].sort((x, y) => x.atMs - y.atMs)) {
    if (a.verified === true && a.memberId) {
      if (seen.has(a.memberId)) continue;
      seen.add(a.memberId);
    }
    out.push(a);
  }
  return out;
}

/**
 * 運営端末（ホスト/管理）が、回答ラウンドの回答の一覧をリアルタイムに見る。
 * 回答数の変化（更新の通知で届く）をきっかけにだけ一覧を取りに行くので、定期的な問い合わせはしない。
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
        answers.value = uniqueAnswers(result.answers);
        count.value = result.round.answerCount;
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
  const stopCount = watch(
    () => (state.value.round && state.value.round.key === key.value ? state.value.round.answerCount : null),
    (next) => {
      if (next === null) return;
      count.value = next;
      if (next !== answers.value.length) schedule();
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
