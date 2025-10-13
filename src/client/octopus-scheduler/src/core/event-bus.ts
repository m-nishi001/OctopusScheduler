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
}>();
