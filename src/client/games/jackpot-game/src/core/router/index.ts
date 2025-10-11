import HomeView from "../../ui/screens/home/home.vue";
import DrawView from "../../ui/screens/main-draw/draw-view.vue";
import ResultView from "../../ui/screens/result/result-view.vue";
import HistoryView from "../../ui/screens/result/history-view.vue";
import OpeningView from "../../ui/screens/opening/opening-view.vue";
import EndingView from "../../ui/screens/ending/ending-view.vue";
import DescriptionView from "../../ui/screens/description/description-view.vue";
import DemoDraw from "../../ui/screens/demo/demo-draw.vue";
import MainDraw from "../../ui/screens/main-draw/main-draw.vue";
import AdminLayout from "../../ui/screens/admin/frames/admin-view.vue";
import AdminMembers from "../../ui/screens/admin/admin-members.vue";
import AdminPrizes from "../../ui/screens/admin/admin-prizes.vue";
import AdminScreens from "../../ui/screens/admin/admin-screens.vue";
import AdminAssets from "../../ui/screens/admin/admin-assets.vue";

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
      { path: "screens", component: AdminScreens },
      { path: "assets", component: AdminAssets },
    ],
  },
];

export default jackpotGameRoutes;
