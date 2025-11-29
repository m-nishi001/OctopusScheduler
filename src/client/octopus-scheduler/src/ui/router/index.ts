import Home from "../../components/home-view.vue";
import Settings from "../../components/settings-view.vue";
import Execute from "../../components/execute-view.vue";
import AssetListEditor from "../components/settings/asset-list/asset-list-editor.vue";
import EventEditor from "../components/settings/event-list/event-list.vue";
import ShowImage from "../components/app-event-handler/show-content/show-image.vue";
import ShowVideo from "../components/app-event-handler/show-content/show-video.vue";
import ShowHtml from "../components/app-event-handler/show-content/show-html.vue";
import ShowSlideshow from "../components/app-event-handler/show-content/show-slideshow.vue";

const octopusSchedulerRoutes = [
  {
    path: "/home",
    name: "home",
    component: Home,
  },
  {
    path: "/settings",
    name: "settings",
    component: Settings,
  },
  {
    path: "/execute",
    name: "execute",
    component: Execute,
    children: [
      {
        path: "show-image/:id",
        name: "show-image",
        component: ShowImage,
        props: true,
      },
      {
        path: "show-video/:id",
        name: "show-video",
        component: ShowVideo,
        props: true,
      },
      {
        path: "show-html/:content",
        name: "show-html",
        component: ShowHtml,
        props: true,
      },
      {
        path: "show-slideshow/:data",
        name: "show-slideshow",
        component: ShowSlideshow,
        props: true,
      },
    ],
  },
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/assets",
    name: "asset-list-editor",
    component: AssetListEditor,
  },
  {
    path: "/events",
    name: "event-editor",
    component: EventEditor,
  },
  {
    path: "/show-image/:id",
    redirect: (to: any) => ({
      name: "show-image",
      params: { id: to.params.id },
    }),
  },
  {
    path: "/show-video/:id",
    redirect: (to: any) => ({
      name: "show-video",
      params: { id: to.params.id },
    }),
  },
  {
    path: "/show-html/:content",
    redirect: (to: any) => ({
      name: "show-html",
      params: { content: to.params.content },
    }),
  },
  {
    path: "/show-slideshow/:data",
    redirect: (to: any) => ({
      name: "show-slideshow",
      params: { data: to.params.data },
    }),
  },
];

export default octopusSchedulerRoutes;
