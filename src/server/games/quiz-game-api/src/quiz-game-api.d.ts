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
  correctNo: number;
  formUrl: string;
  timeLimit: number;
  bgm: string | null;
  settings?: {
    correctBgmDataUrl: string | null;
    prizeImageDataUrl: string | null;
    prizeName: string;
    prizeBgmDataUrl: string | null;
  };
}

export interface ProcessedResultDto {
  playerId?: string | null;
  playerName?: string | null;
  isCorrect: boolean;
  timeToAnswerMs: number;
  timestampMs: number;
  rank?: number | null;
  rawRow?: any[];
}
