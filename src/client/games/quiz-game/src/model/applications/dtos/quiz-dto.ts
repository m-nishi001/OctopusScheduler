export interface QuizDto {
  id: string;
  title: string;
  question: string;
  answerUrl: string;
  /** optional parsed form id extracted from answerUrl */
  answerFormId?: string;
  correctNo?: number;
  timeLimit: number;
  options: {
    no: number;
    text: string;
    color: string;
    image: Blob | string | null;
  }[];
  bgm: Blob | string | null;
}

export interface AddQuizDto {
  title: string;
  question: string;
  answerUrl: string;
  correctNo?: number;
  timeLimit: number;
  options: {
    no: number;
    text: string;
    color: string;
    image: Blob | string | null;
  }[];
  bgm: Blob | string | null;
}

export interface UpdateQuizDto {
  id: string;
  title: string;
  question: string;
  answerUrl: string;
  correctNo?: number;
  timeLimit: number;
  options: {
    no: number;
    text: string;
    color: string;
    image: Blob | string | null;
  }[];
  bgm: Blob | string | null;
}

export interface DeleteQuizDto {
  id: string;
}
