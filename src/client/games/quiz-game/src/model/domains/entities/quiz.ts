export interface Quiz {
  id: string;
  title: string;
  question: string;
  options: { text: string; color: string; image: string }[];
  formUrl: string;
  timeLimit: number;
}
