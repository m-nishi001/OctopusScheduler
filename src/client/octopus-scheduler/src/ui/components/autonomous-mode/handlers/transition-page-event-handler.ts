import { eventBus } from "../../../../core/event-bus";

export class TransitionPageEventHandler {
  constructor(private globalState: any) {
    eventBus.on("transitionPage", this.handleTransitionPage.bind(this));
  }

  private async handleTransitionPage(data: { transitionUrl: string }) {
    this.globalState.nextPage = data.transitionUrl;
  }
}
