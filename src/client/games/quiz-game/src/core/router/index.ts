import QuizResult from "../../ui/pages/quiz-result/quiz-result.vue";
import QuizAdmin from "../../ui/pages/quiz-admin/quiz-admin.vue";
import QuizIntro from "../../ui/pages/quiz-display/quiz-intro.vue";
import QuizQr from "../../ui/pages/quiz-display/quiz-qr.vue";
import QuizPlay from "../../ui/pages/quiz-display/quiz-play.vue";
const quizGameRoutes = [
  { path: "/quiz-home", component: QuizAdmin },
  {
    path: "/quiz/:id",
    // avoid a strict router type mismatch across different vue-router versions
    redirect: (to: any) => `/quiz/${to.params.id}/intro`,
  },
  { path: "/quiz/:id/intro", component: QuizIntro },
  { path: "/quiz/:id/qr", component: QuizQr },
  { path: "/quiz/:id/play", component: QuizPlay },
  { path: "/quiz-result/:id", component: QuizResult },
  { path: "/quiz-admin", component: QuizAdmin },
];

export default quizGameRoutes;
