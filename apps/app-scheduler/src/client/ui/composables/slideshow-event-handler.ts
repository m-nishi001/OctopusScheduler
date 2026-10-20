import type { Router } from "vue-router";
import { eventBus } from "@octopus/client-common/events/event-bus";

/** 実行画面で、`startSlideshow` / `stopSlideshow` のイベントを受けてスライドショーを始める・止める。 */
export class SlideshowEventHandler {
  static register(router: Router) {
    eventBus.on(
      "startSlideshow",
      (data: {
        folderId: string;
        displayDuration: number;
        transitionType: "fade" | "slide";
        slideDirection?: "left" | "right" | "up" | "down";
        bgmIds: string[];
      }) => this.handleStartSlideshow(data, router)
    );
    eventBus.on("stopSlideshow", () => this.handleStopSlideshow(router));
  }

  private static async handleStartSlideshow(
    data: {
      folderId: string;
      displayDuration: number;
      transitionType: "fade" | "slide";
      slideDirection?: "left" | "right" | "up" | "down";
      bgmIds: string[];
    },
    router: Router
  ) {
    router.push({
      name: "show-slideshow",
      params: { data: JSON.stringify(data) },
    });
  }

  private static async handleStopSlideshow(router: Router) {
    router.back();
  }
}
