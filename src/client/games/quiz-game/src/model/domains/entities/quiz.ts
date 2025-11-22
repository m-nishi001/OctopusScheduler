export class Quiz {
  id: string;
  title: string;
  question: string;
  options: {
    no: number;
    text: string;
    color: string;
    image: Blob | string | null;
  }[];
  correctNo: number;
  formUrl: string;
  timeLimit: number;
  bgm: Blob | string | null;

  constructor(quizData: Omit<Quiz, "id"> | Quiz) {
    this.id = "id" in quizData ? quizData.id : "";
    this.title = quizData.title;
    this.question = quizData.question;
    this.options = quizData.options;
    this.correctNo = (quizData as any).correctNo ?? 1;
    this.formUrl = quizData.formUrl;
    this.timeLimit = quizData.timeLimit;
    this.bgm = quizData.bgm;
  }
}
