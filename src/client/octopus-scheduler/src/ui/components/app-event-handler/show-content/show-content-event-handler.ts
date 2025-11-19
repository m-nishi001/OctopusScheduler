import type { Router } from "vue-router";
import { eventBus } from "../../../../core/event-bus";

export class ShowContentEventHandler {
  static register(router: Router) {
    eventBus.on(
      "showContent",
      (data: {
        contentType: "image" | "movie" | "html";
        contentId?: string;
        htmlString?: string;
        manual?: boolean;
      }) => this.handleShowContent(data, router)
    );
    eventBus.on("hideContent", () => this.handleHideContent(router));
  }

  private static async handleShowContent(
    data: {
      contentType: "image" | "movie" | "html";
      contentId?: string;
      htmlString?: string;
      displayMode?: "fade" | "scroll-up" | "scroll-down";
      effect?: "fade" | "scroll" | "static";
      duration?: number;
      fadeInTime?: number;
      fadeOutTime?: number;
      scrollDirection?: "up" | "down" | "left" | "right";
      manual?: boolean;
    },
    router: Router
  ) {
    if (data.contentType === "image") {
      if (data.contentId) {
        router.push({
          name: "show-image",
          params: { id: data.contentId },
            query: {
            displayMode: data.displayMode || "fade",
            effect: data.effect || "fade",
            duration: data.duration?.toString() || "3",
            fadeInTime: data.fadeInTime?.toString() || "1",
            fadeOutTime: data.fadeOutTime?.toString() || "1",
            scrollDirection: data.scrollDirection || "up",
              ...(data.manual ? { manual: "true" } : {}),
          },
        });
      }
    } else if (data.contentType === "movie") {
      if (data.contentId) {
        router.push({
          name: "show-video",
          params: { id: data.contentId },
            query: {
            displayMode: data.displayMode || "fade",
            effect: data.effect || "fade",
            fadeInTime: data.fadeInTime?.toString() || "1",
              ...(data.manual ? { manual: "true" } : {}),
          },
        });
      }
    } else if (data.contentType === "html") {
      if (data.htmlString) {
        const encoded = encodeURIComponent(data.htmlString);
        router.push({
          name: "show-html",
          params: { content: encoded },
          query: { displayMode: data.displayMode || "fade", ...(data.manual ? { manual: "true" } : {}) },
        });
      }
    }
  }

  private static async handleHideContent(router: Router) {
    // コンテンツを隠すために、前のページに戻る
    router.back();
  }
}
