// quiz-game 機能モジュールの公開 API。
export { default as quizGameRoutes } from "./control/router";
export { Container as QuizContainer } from "./control/container";
// 管理コンソールのクイズ選択と、ホスト端末のデータ準備(Driveからの取り込み)に使う。
export { SyncService as QuizSyncService } from "./control/sync/sync-service";
export { GetAllQuizzesUseCase } from "./control/use-cases/get-all-quizzes-use-case";
export type { QuizDto } from "./control/dto/quiz-dto";
