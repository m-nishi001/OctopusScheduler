export interface QuizDto {
  id: string;
  title: string;
  question: string;
  options: { text: string; color: string; image: Blob | null }[];
  formUrl: string;
  timeLimit: number;
  bgm: Blob | null;
}

export interface AddQuizDto {
  title: string;
  question: string;
  options: { text: string; color: string; image: Blob | null }[];
  formUrl: string;
  timeLimit: number;
  bgm: Blob | null;
}
