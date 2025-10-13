import { eventBus } from "../../../core/event-bus";

export class TransitionPageEventHandler {
  static register(router: any) {
    eventBus.on("transitionPage", (data: { transitionUrl: string }) =>
      this.handleTransitionPage(data, router)
    );
  }

  private static async handleTransitionPage(
    data: { transitionUrl: string },
    router: any
  ) {
    router.push({ path: data.transitionUrl });
  }
}
