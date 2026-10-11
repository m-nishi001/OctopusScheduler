import type { RouteRecordRaw } from "vue-router";
import PortalLayout from "./ui/portal-layout.vue";
import PortalHome from "./ui/pages/portal-home.vue";
import PortalEvent from "./ui/pages/portal-event.vue";
import PortalMe from "./ui/pages/portal-me.vue";

/**
 * 参加者ポータルのルート。`/p` 配下で、レイアウト(固定ヘッダー・イベントのバナー・下タブ)の中に各ページが入る。
 * 画面を足すときは children に足す。ゲーム固有の参加画面は、イベントの種類に応じてここへ登録していく。
 */
export const participantPortalRoutes: RouteRecordRaw[] = [
  {
    path: "/p",
    component: PortalLayout,
    children: [
      { path: "", name: "participant-home", component: PortalHome },
      { path: "event", name: "participant-event", component: PortalEvent },
      { path: "me", name: "participant-me", component: PortalMe },
    ],
  },
];
