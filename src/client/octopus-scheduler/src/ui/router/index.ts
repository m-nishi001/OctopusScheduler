import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../components/Home.vue')
  },
  {
    path: '/assets',
    name: 'asset-editor',
    component: () => import('../components/AssetList/AssetEditor.vue')
  },
  {
    path: '/events',
    name: 'event-editor',
    component: () => import('../components/EventList/EventEditor.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
