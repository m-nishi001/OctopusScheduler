import QuizResult from "../../ui/pages/quiz-result/quiz-result.vue";
import AdminLayout from "../../ui/pages/quiz-admin/frames/admin-view.vue";
import QuizList from "../../ui/pages/quiz-admin/components/quiz-list.vue";
import MemberManagement from "../../ui/pages/quiz-admin/components/member-management.vue";
import QuizIntro from "../../ui/pages/quiz-display/quiz-intro.vue";
import QuizQr from "../../ui/pages/quiz-display/quiz-qr.vue";
import QuizPlay from "../../ui/pages/quiz-display/quiz-play.vue";
import QuizAnswer from "../../ui/pages/quiz-display/quiz-answer.vue";
import QuizParticipant from "../../ui/pages/quiz-participant/quiz-participant.vue";
const quizGameRoutes = [
  { path: "/quiz-home", redirect: "/quiz-admin" },
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
  {
    path: "/quiz-admin",
    component: AdminLayout,
    children: [
      // redirect by name, not a relative string: vue-router resolves a plain
      // string redirect as an absolute path, not relative to this parent.
      { path: "", redirect: { name: "quiz-admin-quizzes" } },
      { path: "quizzes", name: "quiz-admin-quizzes", component: QuizList },
      { path: "members", name: "quiz-admin-members", component: MemberManagement },
    ],
  },
  // 参加者がQRコードから開く回答画面(スマホ想定、管理者側のローカルキャッシュには依存しない)
  { path: "/quiz/:id/join", name: "quiz-join", component: QuizParticipant },
];

export default quizGameRoutes;
