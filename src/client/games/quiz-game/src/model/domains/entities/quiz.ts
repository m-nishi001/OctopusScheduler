export class Quiz {
  id: string;
  title: string;
  question: string;
  options: { text: string; color: string; image: Blob | null }[];
  formUrl: string;
  timeLimit: number;
  bgm: Blob | null;

  constructor(quizData: Omit<Quiz, "id"> | Quiz) {
    this.id = "id" in quizData ? quizData.id : "";
    this.title = quizData.title;
    this.question = quizData.question;
    this.options = quizData.options;
    this.formUrl = quizData.formUrl;
    this.timeLimit = quizData.timeLimit;
    this.bgm = quizData.bgm;
  }
}
