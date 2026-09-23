declare module "presenters/content-deck/router" {
  import type { RouteRecordRaw } from "vue-router";
  export const routes: RouteRecordRaw[];
}

declare module "games/card-game/router" {
  import type { RouteRecordRaw } from "vue-router";
  const routes: RouteRecordRaw[];
  export default routes;
}

declare module "games/quiz-game/core/router" {
  import type { RouteRecordRaw } from "vue-router";
  const routes: RouteRecordRaw[];
  export default routes;
}
