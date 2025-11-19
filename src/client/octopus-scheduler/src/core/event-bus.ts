import mitt from "mitt";

export const eventBus = mitt<{
  playAudio: { audioId?: string };
  stopAudio: void;
  showContent: {
    contentType: "image" | "movie" | "html";
    // If true, the content was triggered manually (via keyboard shortcut)
    // and should remain visible until hideContent is emitted.
    manual?: boolean;
    contentId?: string;
    htmlString?: string;
    displayMode?: "fade" | "scroll-up" | "scroll-down";
    effect?: "fade" | "scroll" | "static";
    duration?: number;
    fadeInTime?: number;
    fadeOutTime?: number;
    scrollDirection?: "up" | "down" | "left" | "right";
  };
  // hideContent may be emitted without args (e.g. Escape key) or with
  // contentType for explicit hiding.
  hideContent: { contentType?: "image" | "movie" | "html" } | void;
  transitionPage: { transitionUrl: string };
  startSlideshow: {
    folderId: string;
    displayDuration: number;
    transitionType: "fade" | "slide";
    slideDirection?: "left" | "right" | "up" | "down";
    bgmIds: string[];
  };
  stopSlideshow: void;
}>();
