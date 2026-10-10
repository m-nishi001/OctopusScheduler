import { getCurrentInstance, onUnmounted, ref } from 'vue';
import { container } from 'tsyringe';
import type { QuizSessionScope } from '../../../server/quiz-api-contract';
import { QuizRoundGateway } from '../../model/quiz-round-gateway';
import type { OpenedRound } from '../../model/quiz-round-gateway';

export interface UseAnswerWindowDeps {
  gateway?: Pick<QuizRoundGateway, 'open' | 'close'>;
}

export interface AnswerWindowOption {
  no: number;
  text: string;
}

export interface StartAnswerWindowArgs {
  quizId: string;
  timeLimit: number;
  options: AnswerWindowOption[];
  scope: QuizSessionScope;
  /** 受付が開始できたとき(セッションのホストとして接続している場合)。締切(サーバ時刻)を受け取る。 */
  onOpened?: (round: OpenedRound) => void;
  /** タイマー終了・手動停止のどちらでも、締切処理が始まる直前に一度だけ呼ばれる。 */
  onFinish?: () => void;
}

/**
 * クイズの回答受付ウィンドウ(カウントダウン + 受付開始/終了)を管理するcomposable。
 *
 * 受付の締切はセッション基盤(サーバ時刻)が持つので、このタイマーは表示用。開始時にサーバから
 * 返る残り時間でカウントダウンを揃え、ホストのリロードや端末の時計ずれがあっても参加者の
 * 画面と同じ時刻に終わる。タイマー終了時の自動締切と、管理者の「今すぐ受付停止」からの
 * 手動締切は同じ finish() に集約し、二重に締切処理が走らないようにする。
 */
export function useAnswerWindow(deps?: UseAnswerWindowDeps) {
  const gateway = deps?.gateway ?? container.resolve(QuizRoundGateway);

  const timeLeft = ref(0);
  const showModal = ref(false);
  const isLoading = ref(false);
  const canProceed = ref(false);
  const errorMessage = ref<string | null>(null);

  let timer: ReturnType<typeof setInterval> | undefined;
  let currentQuizId = '';
  let currentScope: QuizSessionScope = 'live';
  let onFinishCallback: (() => void) | undefined;
  let finishing = false;

  async function finish(): Promise<void> {
    if (finishing) return;
    finishing = true;
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    onFinishCallback?.();

    showModal.value = true;
    isLoading.value = true;
    canProceed.value = false;
    errorMessage.value = null;

    try {
      await gateway.close(currentQuizId, currentScope);
    } catch (err) {
      // 締切はサーバ側の時刻でも自動的に来るので、失敗しても進行は止めない。
      console.error('Failed to close the answer round', err);
      errorMessage.value = '受付終了の通知に失敗しました(締切時刻には自動で終了します)。';
    }
    isLoading.value = false;
    canProceed.value = true;
  }

  async function start(args: StartAnswerWindowArgs): Promise<void> {
    currentQuizId = args.quizId;
    currentScope = args.scope;
    onFinishCallback = args.onFinish;
    finishing = false;
    timeLeft.value = args.timeLimit;

    // 受付は出題の瞬間に開く(QR表示中などに回答されないように)。
    try {
      const round = await gateway.open(args.quizId, args.scope, args.options, args.timeLimit);
      if (round) {
        timeLeft.value = Math.max(0, Math.ceil(round.remainingMs / 1000));
        args.onOpened?.(round);
      }
    } catch (e) {
      console.error('Failed to open the answer round', e);
      errorMessage.value = '回答の受付を開始できませんでした。';
    }

    timer = setInterval(() => {
      timeLeft.value--;
      if (timeLeft.value <= 0) {
        void finish();
      }
    }, 1000);
  }

  function emergencyStop(): void {
    if (showModal.value) return; // already stopping/stopped
    void finish();
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (timer) clearInterval(timer);
    });
  }

  return { timeLeft, showModal, isLoading, canProceed, errorMessage, start, emergencyStop };
}
