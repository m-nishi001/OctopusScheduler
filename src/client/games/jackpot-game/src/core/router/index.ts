import HomeView from "../../ui/pages/home/home.vue";
import DrawOrchestrator from "../../ui/pages/main-draw/draw-orchestrator-view.vue";
import ResultView from "../../ui/pages/result/result-view.vue";
import HistoryView from "../../ui/pages/result/history-view.vue";
import OpeningView from "../../ui/pages/opening/opening-view.vue";
import EndingView from "../../ui/pages/ending/ending-view.vue";
import DescriptionView from "../../ui/pages/description/description-view.vue";
import DemoDraw from "../../ui/pages/demo/demo-draw.vue";
// main-draw and draw-view were consolidated into DrawOrchestrator (draw-orchestrator-page.vue)
// import alias kept as DrawOrchestrator and used for both routes below
// import MainDraw from "pages/main-draw/main-draw.vue";
import AdminLayout from "../../ui/pages/admin/frames/admin-view.vue";
import AdminMembers from "../../ui/pages/admin/admin-members.vue";
import AdminPrizes from "../../ui/pages/admin/admin-prizes.vue";
import HomeScreenConfig from "../../ui/pages/admin/screen-config/home-screen-config.vue";
import OpeningScreenConfig from "../../ui/pages/admin/screen-config/opening-screen-config.vue";
import DescriptionScreenConfig from "../../ui/pages/admin/screen-config/description-screen-config.vue";
import DemoScreenConfig from "../../ui/pages/admin/screen-config/demo-screen-config.vue";
import MainScreenConfig from "../../ui/pages/admin/screen-config/draw-screen-config.vue";
import ResultScreenConfig from "../../ui/pages/admin/screen-config/result-screen-config.vue";
import EndingScreenConfig from "../../ui/pages/admin/screen-config/ending-screen-config.vue";
import AdminAssets from "../../ui/pages/admin/admin-assets.vue";

const jackpotGameRoutes = [
  { path: "/jackpot-home", component: HomeView },
  { path: "/jackpot-draw", component: DrawOrchestrator },
  { path: "/jackpot-result", component: ResultView },
  { path: "/jackpot-history", component: HistoryView },
  { path: "/jackpot-opening", component: OpeningView },
  { path: "/jackpot-ending", component: EndingView },
  { path: "/jackpot-description", component: DescriptionView },
  { path: "/jackpot-demo", component: DemoDraw },
  { path: "/main-draw", component: DrawOrchestrator },
  {
    path: "/jackpot-admin",
    component: AdminLayout,
    children: [
      { path: "", component: AdminMembers },
      { path: "members", component: AdminMembers },
      { path: "prizes", component: AdminPrizes },
      { path: "screens/home", component: HomeScreenConfig },
      { path: "screens/opening", component: OpeningScreenConfig },
      { path: "screens/description", component: DescriptionScreenConfig },
      { path: "screens/demo", component: DemoScreenConfig },
      { path: "screens/draw", component: MainScreenConfig },
      { path: "screens/result", component: ResultScreenConfig },
      { path: "screens/ending", component: EndingScreenConfig },
      { path: "assets", component: AdminAssets },
    ],
  },
];

export default jackpotGameRoutes;
