import type { Option } from "../../domains/value-objects/option";

export interface QuizDto {
  id: string;
  title: string;
  question: string;
  options: Option[];
  formUrl: string;
  spreadsheetUrl: string;
  timeLimit: number;
}
