import QuizResult from "../../ui/pages/quiz-result/quiz-result.vue";
import QuizAdmin from "../../ui/pages/quiz-admin/quiz-admin.vue";
import QuizIntro from "../../ui/pages/quiz-display/quiz-intro.vue";
import QuizQr from "../../ui/pages/quiz-display/quiz-qr.vue";
import QuizPlay from "../../ui/pages/quiz-display/quiz-play.vue";
import type { RouteLocationNormalized } from "vue-router";

const quizGameRoutes = [
  { path: "/", component: QuizAdmin },
  {
    path: "/quiz/:id",
    redirect: (to: RouteLocationNormalized) => `/quiz/${to.params.id}/intro`,
  },
  { path: "/quiz/:id/intro", component: QuizIntro },
  { path: "/quiz/:id/qr", component: QuizQr },
  { path: "/quiz/:id/play", component: QuizPlay },
  { path: "/quiz-result/:id", component: QuizResult },
  { path: "/quiz-admin", component: QuizAdmin },
];

export default quizGameRoutes;
