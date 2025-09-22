const octopusSchedulerRoutes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../components/home/home.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../components/settings/settings.vue')
  },
  {
    path: '/autonomous',
    name: 'autonomous-mode',
    component: () => import('../components/autonomous-mode/autonomous-mode.vue')
  },
  {
    path: '/assets',
    name: 'asset-list-editor',
    component: () => import('../components/settings/asset-list/asset-list-editor.vue')
  },
  {
    path: '/events',
    name: 'event-editor',
    component: () => import('../components/settings/event-list/event-editor.vue')
  }
];

export default octopusSchedulerRoutes;
