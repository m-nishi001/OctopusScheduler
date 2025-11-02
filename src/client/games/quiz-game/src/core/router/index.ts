import QuizDisplay from "../../ui/pages/quiz-display/quiz-display.vue";
import QuizResult from "../../ui/pages/quiz-result/quiz-result.vue";
import QuizAdmin from "../../ui/pages/quiz-admin/quiz-admin.vue";

const quizGameRoutes = [
  { path: "/quiz/:id", component: QuizDisplay },
  { path: "/quiz-result/:id", component: QuizResult },
  { path: "/quiz-admin", component: QuizAdmin },
];

export default quizGameRoutes;
