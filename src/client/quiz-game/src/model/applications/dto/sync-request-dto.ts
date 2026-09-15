import type { QuizWithDataUrl } from "quiz-game-api";

export interface SyncRequestDto {
  direction: "gas-to-local" | "local-to-gas";
  quizzes?: QuizWithDataUrl[];
}

export default SyncRequestDto;
