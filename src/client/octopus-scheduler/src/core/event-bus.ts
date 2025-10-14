import mitt from "mitt";

export const eventBus = mitt<{
  playAudio: { audioId?: string };
  stopAudio: void;
  showContent: {
    contentType: "image" | "movie" | "html";
    contentId?: string;
    htmlString?: string;
    displayMode?: "fade" | "scroll-up" | "scroll-down";
    effect?: "fade" | "scroll" | "static";
    duration?: number;
    fadeInTime?: number;
    fadeOutTime?: number;
    scrollDirection?: "up" | "down" | "left" | "right";
  };
  hideContent: { contentType: "image" | "movie" | "html" };
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
