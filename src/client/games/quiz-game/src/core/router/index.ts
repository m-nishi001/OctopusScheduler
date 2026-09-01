import QuizResult from "../../ui/pages/quiz-result/quiz-result.vue";
import QuizAdmin from "../../ui/pages/quiz-admin/quiz-admin.vue";
import QuizIntro from "../../ui/pages/quiz-display/quiz-intro.vue";
import QuizQr from "../../ui/pages/quiz-display/quiz-qr.vue";
import QuizPlay from "../../ui/pages/quiz-display/pages/quiz-play.vue";
import QuizAnswer from "../../ui/pages/quiz-display/quiz-answer.vue";
const quizGameRoutes = [
  { path: "/quiz-home", component: QuizAdmin },
  {
    path: "/quiz/:id",
    // redirect to named intro route, preserving params and query
    redirect: (to: any) => ({
      name: "quiz-intro",
      params: to.params,
      query: to.query,
    }),
  },
  { path: "/quiz/:id/intro", name: "quiz-intro", component: QuizIntro },
  {
    path: "/quiz/:id/intro/preview",
    name: "quiz-intro-preview",
    component: QuizIntro,
    props: (route: any) => ({ ...route.params, preview: true }),
  },
  { path: "/quiz/:id/qr", name: "quiz-qr", component: QuizQr },
  {
    path: "/quiz/:id/qr/preview",
    name: "quiz-qr-preview",
    component: QuizQr,
    props: (route: any) => ({ ...route.params, preview: true }),
  },
  { path: "/quiz/:id/play", name: "quiz-play", component: QuizPlay },
  {
    path: "/quiz/:id/play/preview",
    name: "quiz-play-preview",
    component: QuizPlay,
    props: (route: any) => ({ ...route.params, preview: true }),
  },
  { path: "/quiz/:id/answer", name: "quiz-answer", component: QuizAnswer },
  {
    path: "/quiz/:id/answer/preview",
    name: "quiz-answer-preview",
    component: QuizAnswer,
    props: (route: any) => ({ ...route.params, preview: true }),
  },
  // result routes: production and preview
  { path: "/quiz/:id/result", name: "quiz-result", component: QuizResult },
  {
    path: "/quiz/:id/result/preview",
    name: "quiz-result-preview",
    component: QuizResult,
    props: (route: any) => ({ ...route.params, preview: true }),
  },
  // legacy path kept for compatibility
  { path: "/quiz-result/:id", component: QuizResult },
  { path: "/quiz-admin", component: QuizAdmin },
];

export default quizGameRoutes;
