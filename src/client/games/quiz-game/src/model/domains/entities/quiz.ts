import type { Option } from "../value-objects/option";

export interface Quiz {
  id: string;
  title: string;
  question: string;
  options: Option[];
  formUrl: string;
  spreadsheetUrl: string;
  timeLimit: number;
}
