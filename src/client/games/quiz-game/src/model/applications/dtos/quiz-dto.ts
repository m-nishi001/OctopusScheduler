export interface QuizDto {
  id: string;
  title: string;
  question: string;
  answerUrl: string;
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
