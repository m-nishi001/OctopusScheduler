/**
 * Quiz game API types
 */

export interface SheetRow {
  name: string;
  time: number;
}

export interface QuizWithDataUrl {
  id: string;
  title: string;
  question: string;
  options: { no: number; text: string; color: string; image: string | null }[];
  formUrl: string;
  timeLimit: number;
  bgm: string | null;
}

export interface SyncRequest {
  direction: "gas-to-local" | "local-to-gas";
  quizzes?: QuizWithDataUrl[];
}
