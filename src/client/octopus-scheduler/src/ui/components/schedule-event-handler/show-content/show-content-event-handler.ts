import { eventBus } from "../../../../core/event-bus";

export class ShowContentEventHandler {
  constructor(private router: any) {
    eventBus.on("showContent", this.handleShowContent.bind(this));
    eventBus.on("hideContent", this.handleHideContent.bind(this));
  }

  private async handleShowContent(data: {
    contentType: "image" | "movie" | "html";
    contentId?: string;
    htmlString?: string;
  }) {
    if (data.contentType === "image") {
      if (data.contentId) {
        this.router.push({
          name: "show-image",
          params: { id: data.contentId },
        });
      }
    } else if (data.contentType === "movie") {
      if (data.contentId) {
        this.router.push({
          name: "show-video",
          params: { id: data.contentId },
        });
      }
    } else if (data.contentType === "html") {
      if (data.htmlString) {
        const encoded = encodeURIComponent(data.htmlString);
        this.router.push({ name: "show-html", params: { content: encoded } });
      }
    }
  }

  private async handleHideContent() {
    // コンテンツを隠すために、前のページに戻る
    this.router.back();
  }
}
