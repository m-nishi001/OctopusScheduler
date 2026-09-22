import type { QuizWithDataUrl } from "../../../server/quiz-api-contract";

export interface SyncRequestDto {
  direction: "gas-to-local" | "local-to-gas";
  quizzes?: QuizWithDataUrl[];
}

export default SyncRequestDto;
