export class TransitionPageEventDetail {
  pageId: string;
  transitionType?: string;
  constructor(pageId: string, transitionType?: string) {
    this.pageId = pageId;
    this.transitionType = transitionType;
  }
}
