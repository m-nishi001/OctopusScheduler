import type { Router } from "vue-router";
import { eventBus } from "../../../core/event-bus";

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
