export interface Quiz {
  id: string;
  title: string;
  question: string;
  options: { text: string; color: string; imageId: string | null }[];
  formUrl: string;
  timeLimit: number;
}
