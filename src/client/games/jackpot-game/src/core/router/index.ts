// import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../../ui/components/admin/home-view.vue';
import DrawView from '../../ui/components/draw/draw-view.vue';
import ResultView from '../../ui/components/draw/result-view.vue';
import HistoryView from '../../ui/components/draw/history-view.vue';
import OpeningView from '../../ui/components/draw/opening-view.vue';
import AdminLayout from '../../ui/components/admin/admin-layout.vue';
import AdminMembers from '../../ui/components/admin/admin-members.vue';
import AdminPrizes from '../../ui/components/admin/admin-prizes.vue';
import AdminScreens from '../../ui/components/admin/admin-screens.vue';


const jackpotGameRoutes = [
  { path: '/jackpot-home', component: HomeView },
  { path: '/jackpot-draw', component: DrawView },
  { path: '/jackpot-result', component: ResultView },
  { path: '/jackpot-history', component: HistoryView },
  { path: '/jackpot-opening', component: OpeningView },
  {
    path: '/jackpot-admin',
    component: AdminLayout,
    children: [
      { path: '', component: AdminMembers },
      { path: 'members', component: AdminMembers },
      { path: 'prizes', component: AdminPrizes },
      { path: 'screens', component: AdminScreens },
    ]
  }
];

// const router = createRouter({
//   history: createWebHistory(),
//   routes,
// });

export default jackpotGameRoutes;
