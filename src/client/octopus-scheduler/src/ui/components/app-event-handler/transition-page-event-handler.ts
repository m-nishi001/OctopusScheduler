import type { Router } from "vue-router";
import { eventBus } from "../../../core/event-bus";

export class TransitionPageEventHandler {
  static register(router: Router) {
    eventBus.on("transitionPage", (data: { transitionUrl: string }) =>
      this.handleTransitionPage(data, router)
    );
  }

  private static async handleTransitionPage(
    data: { transitionUrl: string },
    router: Router
  ) {
    await router.push({ path: data.transitionUrl });
  }
}
