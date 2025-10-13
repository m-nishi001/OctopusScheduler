import mitt from "mitt";

export const eventBus = mitt<{
  playAudio: { audioId?: string };
  stopAudio: void;
  showContent: {
    contentType: "image" | "movie" | "html";
    contentId?: string;
    htmlString?: string;
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
