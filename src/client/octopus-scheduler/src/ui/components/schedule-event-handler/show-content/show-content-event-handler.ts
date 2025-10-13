import { eventBus } from "../../../../core/event-bus";

export class ShowContentEventHandler {
  static register(router: any) {
    eventBus.on(
      "showContent",
      (data: {
        contentType: "image" | "movie" | "html";
        contentId?: string;
        htmlString?: string;
      }) => this.handleShowContent(data, router)
    );
    eventBus.on("hideContent", () => this.handleHideContent(router));
  }

  private static async handleShowContent(
    data: {
      contentType: "image" | "movie" | "html";
      contentId?: string;
      htmlString?: string;
    },
    router: any
  ) {
    if (data.contentType === "image") {
      if (data.contentId) {
        router.push({
          name: "show-image",
          params: { id: data.contentId },
        });
      }
    } else if (data.contentType === "movie") {
      if (data.contentId) {
        router.push({
          name: "show-video",
          params: { id: data.contentId },
        });
      }
    } else if (data.contentType === "html") {
      if (data.htmlString) {
        const encoded = encodeURIComponent(data.htmlString);
        router.push({ name: "show-html", params: { content: encoded } });
      }
    }
  }

  private static async handleHideContent(router: any) {
    // コンテンツを隠すために、前のページに戻る
    router.back();
  }
}
