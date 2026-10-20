import { computed, inject, onScopeDispose, ref, shallowRef, watch } from "vue";
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from "vue";
import { readResultsRev } from "@octopus/session-hub";
import type { ResultsView } from "@octopus/session-hub";
import type { PortalSession } from "./use-portal-session";

/**
 * 結果(クイズの順位・ジャックポットの当選履歴)の参加者側。
 *
 * 結果そのものは R2 にあり、ホストが保存するたびに、DO の状態へ「更新番号(rev)」だけが載る。
 * ここでは rev が自分の取得済みより進んだら「新しい結果あり」(stale)とし、
 *   - 「結果」画面を開いている間だけ取り直す(最大 REFETCH_JITTER_MS のばらつきを付け、全員が同時に取りに行かないようにする)
 *   - 開いていなければ取り直さず、タブに印(stale)だけ出す
 * 定期的な問い合わせはしない(無料枠の保護)。取得に失敗したときも自動では再試行せず、「再読み込み」に任せる。
 */
export const REFETCH_JITTER_MS = 3000;

export interface ResultsState {
  /** 最後に取得できた結果。まだ取得していなければ null。 */
  view: ShallowRef<ResultsView | null>;
  loading: Ref<boolean>;
  /** 最後の取得が失敗した。 */
  error: Ref<boolean>;
  /** ホストが保存した結果が、取得済みより新しい(タブの印に使う)。 */
  stale: ComputedRef<boolean>;
  /** 「結果」画面を開いた/閉じた。開いた時点で、未取得または stale なら取得する。 */
  setVisible(visible: boolean): void;
  /** すぐに取り直す(「再読み込み」)。 */
  refresh(): Promise<void>;
}

export const RESULTS_KEY: InjectionKey<ResultsState> = Symbol("portalResults");

/** `PortalLayout` が提供する結果の状態を取り出す。レイアウトの外で呼ぶと例外。 */
export function useResultsContext(): ResultsState {
  const results = inject(RESULTS_KEY, null);
  if (!results) throw new Error("PortalLayout の中で使ってください");
  return results;
}

export interface ResultsOptions {
  /** 0以上1未満の乱数(ばらつき用。テストで固定する)。 */
  random?: () => number;
  jitterMs?: number;
}

/** 参加者に見せる結果の取得。結果の画面を開いたとき(または、ホストが保存した結果が新しいとき)に、ばらつきをつけて取得する。 */
export function useResults(session: PortalSession, options: ResultsOptions = {}): ResultsState {
  const random = options.random ?? Math.random;
  const jitterMs = options.jitterMs ?? REFETCH_JITTER_MS;
  const view = shallowRef<ResultsView | null>(null);
  const loading = ref(false);
  const error = ref(false);
  const visible = ref(false);

  const notifiedRev = computed(() => readResultsRev(session.state.value.roomState?.data) ?? 0);
  const stale = computed(() => notifiedRev.value > (view.value?.rev ?? 0));

  let inflight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clearTimer = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  function refresh(): Promise<void> {
    clearTimer();
    if (inflight) return inflight;
    loading.value = true;
    inflight = session
      .fetchResults()
      .then((next) => {
        // 古い応答で新しい結果を上書きしない
        if (!view.value || next.rev >= view.value.rev) view.value = next;
        error.value = false;
      })
      .catch(() => {
        error.value = true;
      })
      .finally(() => {
        loading.value = false;
        inflight = null;
      });
    return inflight;
  }

  /** 通知(rev の更新)を受けて取り直す。画面を開いているときだけ、少しばらつかせて。 */
  const stopWatchRev = watch(notifiedRev, () => {
    if (!visible.value || !stale.value || timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (visible.value && stale.value) void refresh();
    }, Math.floor(random() * jitterMs));
  });

  // 入室できている間だけ取得できる(「結果」を直接開いた・リロードした直後は、入室が済むのを待つ)
  const connected = computed(() => session.status.value === "connected" || session.status.value === "reconnecting");

  function setVisible(next: boolean): void {
    visible.value = next;
    if (!next) {
      clearTimer();
      return;
    }
    // 開いた直後は待たせない(見に来た人が待っている)。未取得、または新しい結果があれば取得する。
    if (connected.value && (view.value === null || stale.value)) void refresh();
  }

  // 画面を開いたあとに入室できた(または再接続できた)ら、そこで取得する
  const stopWatchConnected = watch(connected, (now) => {
    if (now && visible.value && (view.value === null || stale.value)) void refresh();
  });

  onScopeDispose(() => {
    clearTimer();
    stopWatchRev();
    stopWatchConnected();
  });

  return { view, loading, error, stale, setVisible, refresh };
}
