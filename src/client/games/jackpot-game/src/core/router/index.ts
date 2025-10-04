import HomeView from "../../ui/components/draw/home.vue";
import DrawView from "../../ui/components/draw/draw-view.vue";
import ResultView from "../../ui/components/draw/result-view.vue";
import HistoryView from "../../ui/components/draw/history-view.vue";
import OpeningView from "../../ui/components/draw/opening-view.vue";
import DescriptionView from "../../ui/components/draw/description-view.vue";
import DemoDraw from "../../ui/components/draw/demo-draw.vue";
import MainDraw from "../../ui/components/draw/main-draw.vue";
import AdminLayout from "../../ui/components/admin/admin-layout.vue";
import AdminMembers from "../../ui/components/admin/admin-members.vue";
import AdminPrizes from "../../ui/components/admin/admin-prizes.vue";
import AdminScreens from "../../ui/components/admin/admin-screens.vue";
import AdminAssets from "../../ui/components/admin/admin-assets.vue";

const jackpotGameRoutes = [
  { path: "/jackpot-home", component: HomeView },
  { path: "/jackpot-draw", component: DrawView },
  { path: "/jackpot-result", component: ResultView },
  { path: "/jackpot-history", component: HistoryView },
  { path: "/jackpot-opening", component: OpeningView },
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
