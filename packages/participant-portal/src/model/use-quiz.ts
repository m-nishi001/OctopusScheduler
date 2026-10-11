import { computed, inject, onScopeDispose, ref, watch } from "vue";
import type { ComputedRef, InjectionKey, Ref } from "vue";
import { parseHubErrorCode } from "@octopus/session-hub";
import { readQuizView } from "./activity";
import type { QuizView } from "./activity";
import type { PortalSession } from "./use-portal-session";

export interface QuizStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

function browserStorage(): QuizStorage {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // 保存できなくても回答自体は有効（リロード後の「回答済み」表示が遅れるだけ）
      }
    },
  };
}

export interface QuizState {
  quiz: ComputedRef<QuizView | null>;
  /** 締切までの秒数（サーバー時刻との差で出す）。受付中でなければ null。 */
  remainingSec: ComputedRef<number | null>;
  /** 自分が選んだ選択肢の番号（回答済みのとき）。 */
  myAnswer: Ref<number | null>;
  canAnswer: ComputedRef<boolean>;
  answering: Ref<boolean>;
  message: Ref<string>;
  optionLabel(no: number): string;
  correctLabel: ComputedRef<string>;
  verdictText: ComputedRef<string>;
  answer(no: number): Promise<void>;
}

export const QUIZ_KEY: InjectionKey<QuizState> = Symbol("portalQuiz");

export function useQuizContext(): QuizState {
  const quiz = inject(QUIZ_KEY, null);
  if (!quiz) throw new Error("PortalLayout の中で使ってください");
  return quiz;
}

export interface QuizOptions {
  /** ログイン中のメンバーID。「回答済み」の保存を人ごとに分ける。 */
  memberId: () => string | null;
  storage?: QuizStorage;
  now?: () => number;
}

/**
 * クイズ（回答ラウンド）の参加者側。出題の表示・残り時間・回答・正誤の表示を持つ。
 * 回答は先着で1人1回（別の端末でも）。回答済みはブラウザに（メンバーごとに）保存し、リロードしても残る。
 * 締切の判定はサーバー時刻なので、端末の時計がずれていても公平。
 */
export function useQuiz(session: PortalSession, options: QuizOptions): QuizState {
  const storage = options.storage ?? browserStorage();
  const now = options.now ?? (() => Date.now());
  const quiz = computed(() => readQuizView(session.state.value.roomState?.data));

  // 残り時間の表示を更新する時計。受付中だけ動かす（それ以外は何も動かさない）。
  const nowMs = ref(now());
  let clock: ReturnType<typeof setInterval> | null = null;
  const stopClock = (): void => {
    if (clock) clearInterval(clock);
    clock = null;
  };
  const stopWatchClock = watch(
    () => quiz.value?.phase === "answering",
    (running) => {
      stopClock();
      if (!running) return;
      nowMs.value = now();
      clock = setInterval(() => {
        nowMs.value = now();
      }, 250);
    },
    { immediate: true }
  );

  const remainingSec = computed(() => {
    const deadline = quiz.value?.deadlineMs;
    if (deadline === null || deadline === undefined) return null;
    return Math.max(0, Math.ceil((deadline - (nowMs.value + session.state.value.serverOffsetMs)) / 1000));
  });

  const myAnswer = ref<number | null>(null);
  const answering = ref(false);
  const message = ref("");

  const storageKey = (): string | null => {
    const sessionId = session.state.value.session?.id;
    const roundKey = quiz.value?.roundKey;
    const memberId = options.memberId();
    return sessionId && roundKey && memberId ? `octopus.quiz.answer:${memberId}:${sessionId}:${roundKey}` : null;
  };

  // 問題（ラウンド）が変わったら、保存してある自分の回答を読み直す。
  // 文字列で比較する（配列を返すと、更新のたびに「変わった」と判定されて回答済みの表示が消えてしまう）。
  const stopWatchRound = watch(
    () => `${String(options.memberId())}|${String(session.state.value.session?.id)}|${String(quiz.value?.roundKey)}`,
    () => {
      message.value = "";
      const key = storageKey();
      const saved = key ? storage.get(key) : null;
      myAnswer.value = saved ? Number(saved) : null;
    },
    { immediate: true }
  );

  const canAnswer = computed(
    () => quiz.value?.phase === "answering" && (remainingSec.value ?? 0) > 0 && myAnswer.value === null && !answering.value
  );

  const optionLabel = (no: number): string => {
    const o = quiz.value?.options.find((x) => x.no === no);
    return o ? `${no}. ${o.text}` : String(no);
  };
  const correctLabel = computed(() => (quiz.value?.correctNo != null ? optionLabel(quiz.value.correctNo) : ""));
  const verdictText = computed(() => {
    if (myAnswer.value === null) return "";
    return myAnswer.value === quiz.value?.correctNo ? "正解！" : `残念… あなたの回答: ${optionLabel(myAnswer.value)}`;
  });

  async function answer(no: number): Promise<void> {
    const key = quiz.value?.roundKey;
    if (!canAnswer.value || !key) return;
    answering.value = true;
    message.value = "";
    try {
      const result = await session.answer(key, no);
      myAnswer.value = result.no;
      const saveKey = storageKey();
      if (saveKey) storage.set(saveKey, String(result.no));
      if (result.duplicate) message.value = `すでに回答済みです(選択: ${optionLabel(result.no)})`;
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const code = parseHubErrorCode(text);
      message.value =
        code === "ROUND_CLOSED" || code === "ROUND_NOT_OPEN"
          ? "受付は終了しました"
          : code
            ? text.replace(/^\[[A-Z_]+\]\s*/, "")
            : "通信できませんでした。電波の良い場所で、もう一度押してください";
    } finally {
      answering.value = false;
    }
  }

  onScopeDispose(() => {
    stopClock();
    stopWatchClock();
    stopWatchRound();
  });

  return { quiz, remainingSec, myAnswer, canAnswer, answering, message, optionLabel, correctLabel, verdictText, answer };
}
