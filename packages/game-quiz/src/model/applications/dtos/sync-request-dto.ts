import type { QuizWithDataUrl } from "@octopus/core";

export interface SyncRequestDto {
  direction: "gas-to-local" | "local-to-gas";
  quizzes?: QuizWithDataUrl[];
}

export default SyncRequestDto;
