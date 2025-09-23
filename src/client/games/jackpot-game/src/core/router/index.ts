// import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../../ui/components/HomeView.vue';
import DrawView from '../../ui/components/DrawView.vue';
import ResultView from '../../ui/components/ResultView.vue';
import HistoryView from '../../ui/components/HistoryView.vue';
import AdminView from '../../ui/components/AdminView.vue';

const jackpotGameRoutes = [
  { path: '/jackpot-home', component: HomeView },
  { path: '/jackpot-draw', component: DrawView },
  { path: '/jackpot-result', component: ResultView },
  { path: '/jackpot-history', component: HistoryView },
  { path: '/jackpot-admin', component: AdminView },
];

// const router = createRouter({
//   history: createWebHistory(),
//   routes,
// });

export default jackpotGameRoutes;
