const octopusSchedulerRoutes = [
  {
    path: "/",
    name: "home",
    component: () => import("../components/home/home.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../components/settings/settings.vue"),
  },
  {
    path: "/assets",
    name: "asset-list-editor",
    component: () =>
      import("../components/settings/asset-list/asset-list-editor.vue"),
  },
  {
    path: "/events",
    name: "event-editor",
    component: () =>
      import("../components/settings/event-list/event-editor.vue"),
  },
  {
    path: "/show-image/:id",
    name: "show-image",
    component: () => import("../components/show-content/show-image.vue"),
    props: true,
  },
  {
    path: "/show-video/:id",
    name: "show-video",
    component: () => import("../components/show-content/show-video.vue"),
    props: true,
  },
  {
    path: "/show-html/:content",
    name: "show-html",
    component: () => import("../components/show-content/show-html.vue"),
    props: true,
  },
];

export default octopusSchedulerRoutes;
