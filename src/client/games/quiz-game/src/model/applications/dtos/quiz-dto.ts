export interface QuizSettings {
  correctBgm: Blob | null;
  prizeImage: Blob | null;
  prizeName: string | null;
  prizeBgm: Blob | null;
}

export interface QuizDto {
  id: string;
  title: string;
  question: string;
  answerUrl: string;
  answerFormId?: string;
  correctNo?: number;
  timeLimit: number;
  options: {
    no: number;
    text: string;
    color: string;
    image: Blob | null;
  }[];
  bgm: Blob | null;
  settings?: QuizSettings;
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
    image: Blob | null;
  }[];
  bgm: Blob | null;
  settings?: QuizSettings;
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
    image: Blob | null;
  }[];
  bgm: Blob | null;
  settings?: QuizSettings;
}

export interface DeleteQuizDto {
  id: string;
}
