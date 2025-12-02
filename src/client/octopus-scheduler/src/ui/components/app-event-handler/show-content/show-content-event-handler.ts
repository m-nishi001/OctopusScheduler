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
        eventId?: string;
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
      // Prefer routing by event id so the show-html component can fetch htmlString
      if (data.eventId) {
        router.push({
          name: "show-html",
          params: { id: data.eventId },
          query: {
            displayMode: data.displayMode || "fade",
            ...(data.manual ? { manual: "true" } : {}),
          },
        });
        return;
      }

      // Fallback: if no eventId but htmlString provided, route to show-html and
      // allow the component to use legacy mechanisms (localStorage/encoded content).
      if (data.htmlString) {
        try {
          // store temporarily in sessionStorage (less persistent than localStorage)
          const sid =
            "html_temp_" +
            Date.now().toString(36) +
            "_" +
            Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem(`octopus:html:${sid}`, data.htmlString);
          router.push({
            name: "show-html",
            params: { id: sid },
            query: {
              displayMode: data.displayMode || "fade",
              ...(data.manual ? { manual: "true" } : {}),
              _temp: "1",
            },
          });
          return;
        } catch (e) {
          // If sessionStorage unavailable, fall back to encoded content in URL
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
