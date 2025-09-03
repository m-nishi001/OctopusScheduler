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
    component: () => import('../components/AssetEditor.vue')
  },
  {
    path: '/events',
    name: 'event-editor',
    component: () => import('../components/EventEditor.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
