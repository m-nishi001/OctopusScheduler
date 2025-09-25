// import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../../ui/components/admin/HomeView.vue';
import DrawView from '../../ui/components/draw/DrawView.vue';
import ResultView from '../../ui/components/draw/ResultView.vue';
import HistoryView from '../../ui/components/draw/HistoryView.vue';
import OpeningView from '../../ui/components/draw/OpeningView.vue';
import AdminLayout from '../../ui/components/admin/AdminLayout.vue';
import AdminMembers from '../../ui/components/admin/AdminMembers.vue';
import AdminPrizes from '../../ui/components/admin/AdminPrizes.vue';
import AdminScreens from '../../ui/components/admin/AdminScreens.vue';


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
