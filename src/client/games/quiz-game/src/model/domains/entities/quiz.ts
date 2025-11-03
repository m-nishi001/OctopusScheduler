export interface Quiz {
  id: string;
  title: string;
  question: string;
  options: { text: string; color: string; image: Blob | null }[];
  formUrl: string;
  timeLimit: number;
  bgm: Blob | null;
}
