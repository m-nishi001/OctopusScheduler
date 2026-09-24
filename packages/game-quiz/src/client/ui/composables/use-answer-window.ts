import { getCurrentInstance, onUnmounted, ref } from 'vue';
import { container } from 'tsyringe';
import { StartAcceptingAnswersUseCase } from '../../control/use-cases/start-accepting-answers-use-case';
import { StopAcceptingAnswersUseCase } from '../../control/use-cases/stop-accepting-answers-use-case';
import type { AcceptanceOption } from '../../../server/quiz-api-contract';

export interface UseAnswerWindowDeps {
  startAcceptingAnswersUseCase?: Pick<StartAcceptingAnswersUseCase, 'execute'>;
  stopAcceptingAnswersUseCase?: Pick<StopAcceptingAnswersUseCase, 'execute'>;
}

export interface StartAnswerWindowArgs {
  quizId: string;
  timeLimit: number;
  options: AcceptanceOption[];
  isPreview: boolean;
  /** タイマー終了・手動停止のどちらでも、締切処理が始まる直前に一度だけ呼ばれる。 */
  onFinish?: () => void;
}

/**
 * クイズの回答受付ウィンドウ(カウントダウン + 受付開始/終了)を管理するcomposable。
 * タイマー終了時の自動締切と、管理者の「今すぐ受付停止」ボタンからの手動締切の
 * 両方を同じfinish()経路に集約し、二重に締切処理が走らないようにする。
 */
export function useAnswerWindow(deps?: UseAnswerWindowDeps) {
  const startAcceptingAnswersUseCase =
    deps?.startAcceptingAnswersUseCase ?? container.resolve(StartAcceptingAnswersUseCase);
  const stopAcceptingAnswersUseCase =
    deps?.stopAcceptingAnswersUseCase ?? container.resolve(StopAcceptingAnswersUseCase);

  const timeLeft = ref(0);
  const showModal = ref(false);
  const isLoading = ref(false);
  const canProceed = ref(false);
  const errorMessage = ref<string | null>(null);

  let timer: ReturnType<typeof setInterval> | undefined;
  let currentQuizId = '';
  let currentIsPreview = false;
  let onFinishCallback: (() => void) | undefined;

  async function finish(): Promise<void> {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    onFinishCallback?.();

    showModal.value = true;
    isLoading.value = true;
    canProceed.value = false;
    errorMessage.value = null;

    if (currentIsPreview) {
      isLoading.value = false;
      canProceed.value = true;
      return;
    }

    try {
      await stopAcceptingAnswersUseCase.execute(currentQuizId);
      isLoading.value = false;
      canProceed.value = true;
    } catch (err) {
      console.error('Failed to stop accepting answers', err);
      errorMessage.value = '受付終了処理に失敗しました。';
      isLoading.value = false;
      canProceed.value = true; // Allow retry or proceed
    }
  }

  async function start(args: StartAnswerWindowArgs): Promise<void> {
    currentQuizId = args.quizId;
    currentIsPreview = args.isPreview;
    onFinishCallback = args.onFinish;
    timeLeft.value = args.timeLimit;

    // Open the answer-acceptance window on the server before starting the visible
    // countdown. Previously the Google Form was always "open", which let
    // participants answer while the QR/intro screens were still showing; now
    // acceptance only opens here, at the moment the question is displayed.
    // Preview runs must not touch the live quiz's acceptance state.
    if (!currentIsPreview) {
      try {
        await startAcceptingAnswersUseCase.execute(args.quizId, args.options);
      } catch (e) {
        console.error('Failed to start accepting answers', e);
      }
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
