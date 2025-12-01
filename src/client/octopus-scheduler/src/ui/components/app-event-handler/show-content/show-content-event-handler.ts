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
        // Store the HTML in localStorage under a short id and route by id instead
        const id =
          "html_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2, 8);
        try {
          localStorage.setItem(`octopus:html:${id}`, data.htmlString);
        } catch (e) {
          // localStorage may not be available; fall back to routing with encoded content
          const encoded = encodeURIComponent(data.htmlString);
          router.push({
            name: "show-html",
            params: { content: encoded },
            query: {
              displayMode: data.displayMode || "fade",
              ...(data.manual ? { manual: "true" } : {}),
            },
          });
          return;
        }

        router.push({
          name: "show-html",
          params: { id },
          query: {
            displayMode: data.displayMode || "fade",
            ...(data.manual ? { manual: "true" } : {}),
          },
        });
      }
    }
  }

  private static async handleHideContent(router: Router) {
    try {
      console.debug(
        "[ShowContentEventHandler] hideContent received — navigating to /execute"
      );
      // Always navigate to the execute screen to ensure any shown content is hidden.
      // Use named route when possible; fallback to path replace.
      try {
        await router.replace({ name: "execute" as any });
      } catch (e) {
        try {
          await router.replace({ path: "/execute" });
        } catch (err) {
          // swallow errors to avoid crashing when router is unavailable
        }
      }
    } catch {
      /* noop */
    }
  }
}
