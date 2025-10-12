import HomeView from "../../ui/pages/home/home.vue";
import DrawView from "../../ui/pages/main-draw/draw-view.vue";
import ResultView from "../../ui/pages/result/result-view.vue";
import HistoryView from "../../ui/pages/result/history-view.vue";
import OpeningView from "../../ui/pages/opening/opening-view.vue";
import EndingView from "../../ui/pages/ending/ending-view.vue";
import DescriptionView from "../../ui/pages/description/description-view.vue";
import DemoDraw from "../../ui/pages/demo/demo-draw.vue";
import MainDraw from "../../ui/pages/main-draw/main-draw.vue";
import AdminLayout from "../../ui/pages/admin/frames/admin-view.vue";
import AdminMembers from "../../ui/pages/admin/admin-members.vue";
import AdminPrizes from "../../ui/pages/admin/admin-prizes.vue";
import AdminScreens from "../../ui/pages/admin/admin-screens.vue";
import AdminAssets from "../../ui/pages/admin/admin-assets.vue";

const jackpotGameRoutes = [
  { path: "/jackpot-home", component: HomeView },
  { path: "/jackpot-draw", component: DrawView },
  { path: "/jackpot-result", component: ResultView },
  { path: "/jackpot-history", component: HistoryView },
  { path: "/jackpot-opening", component: OpeningView },
  { path: "/jackpot-ending", component: EndingView },
  { path: "/jackpot-description", component: DescriptionView },
  { path: "/jackpot-demo", component: DemoDraw },
  { path: "/main-draw", component: MainDraw },
  {
    path: "/jackpot-admin",
    component: AdminLayout,
    children: [
      { path: "", component: AdminMembers },
      { path: "members", component: AdminMembers },
      { path: "prizes", component: AdminPrizes },
      { path: "screens/:screenType?", component: AdminScreens },
      { path: "assets", component: AdminAssets },
    ],
  },
];

export default jackpotGameRoutes;
