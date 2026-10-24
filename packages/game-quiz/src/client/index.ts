// quiz-game 機能モジュールの公開 API。
export { default as quizGameRoutes } from "./control/router";
export { Container as QuizContainer } from "./control/container";
// 管理コンソールのクイズ選択と、ホスト端末のデータ準備(Driveからの取り込み)に使う。
export { SyncService as QuizSyncService } from "./control/sync/sync-service";
export { GetAllQuizzesUseCase } from "./control/use-cases/get-all-quizzes-use-case";
// ホスト端末のエントリー画面(アプリ側で用意する)が、クイズの進行(状態の公開・Enter/「次へ」)に加わるために使う。
export { useQuizStep } from "./ui/composables/use-quiz-step";
export type { QuizDto } from "./control/dto/quiz-dto";
// イベントの終了時に、会場に残るクイズの表示状態(順位発表など)を取り下げるために使う。
export { QUIZ_NAMESPACE } from "./model/quiz-host-state";
