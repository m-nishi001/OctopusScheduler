import { eventBus } from "../../../core/event-bus";

export class TransitionPageEventHandler {
  constructor(private router: any) {
    eventBus.on("transitionPage", this.handleTransitionPage.bind(this));
  }

  private async handleTransitionPage(data: { transitionUrl: string }) {
    this.router.push({ path: data.transitionUrl });
  }
}
