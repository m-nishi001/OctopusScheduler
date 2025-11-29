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
    console.debug(
      `[TransitionPageEventHandler] start handling transition to=${data.transitionUrl} ts=${Date.now()}`,
      router.currentRoute
    );
    try {
      await router.push({ path: data.transitionUrl });
      console.debug(
        `[TransitionPageEventHandler] after push to=${data.transitionUrl} ts=${Date.now()} current=${router.currentRoute.value.fullPath}`
      );
    } catch (err) {
      console.error(
        `[TransitionPageEventHandler] router.push failed to=${data.transitionUrl} err=`,
        err
      );
    }
  }
}
