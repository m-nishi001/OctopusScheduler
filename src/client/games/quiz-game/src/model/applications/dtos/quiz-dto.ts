export interface QuizDto {
  id: string;
  title: string;
  question: string;
  options: { text: string; color: string; image: string }[];
  formUrl: string;
  spreadsheetUrl: string;
  timeLimit: number;
}
