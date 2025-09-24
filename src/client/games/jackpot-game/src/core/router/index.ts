// import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../../ui/components/admin/HomeView.vue';
import DrawView from '../../ui/components/draw/DrawView.vue';
import ResultView from '../../ui/components/draw/ResultView.vue';
import HistoryView from '../../ui/components/draw/HistoryView.vue';
import AdminView from '../../ui/components/admin/AdminView.vue';
import OpeningView from '../../ui/components/draw/OpeningView.vue';

const jackpotGameRoutes = [
  { path: '/jackpot-home', component: HomeView },
  { path: '/jackpot-draw', component: DrawView },
  { path: '/jackpot-result', component: ResultView },
  { path: '/jackpot-history', component: HistoryView },
  { path: '/jackpot-admin', component: AdminView },
  { path: '/jackpot-opening', component: OpeningView },
];

// const router = createRouter({
//   history: createWebHistory(),
//   routes,
// });

export default jackpotGameRoutes;
