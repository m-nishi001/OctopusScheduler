export interface QuizSettings {
  correctBgmDataUrl: string | null;
  prizeImageDataUrl: string | null;
  prizeName: string | null;
  prizeBgmDataUrl: string | null;
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
    image: Blob | string | null;
  }[];
  bgm: Blob | string | null;
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
    image: Blob | string | null;
  }[];
  bgm: Blob | string | null;
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
    image: Blob | string | null;
  }[];
  bgm: Blob | string | null;
  settings?: QuizSettings;
}

export interface DeleteQuizDto {
  id: string;
}
