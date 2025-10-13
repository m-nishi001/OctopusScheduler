import { eventBus } from "../../../../core/event-bus";

export class ShowContentEventHandler {
  constructor(
    private globalState: any,
    private assetService: any
  ) {
    eventBus.on("showContent", this.handleShowContent.bind(this));
    eventBus.on("hideContent", this.handleHideContent.bind(this));
  }

  private async handleShowContent(data: {
    contentType: "image" | "movie" | "html";
    contentId?: string;
    htmlString?: string;
  }) {
    if (data.contentType === "image") {
      this.globalState.showImageModal = true;
      if (data.contentId) {
        const asset = await this.assetService.getAssetById(data.contentId);
        if (asset && asset.dataUrl) {
          this.globalState.imageAssetUrl = asset.dataUrl;
        } else {
          this.globalState.imageAssetUrl = "";
        }
      }
    } else if (data.contentType === "movie") {
      this.globalState.showVideoModal = true;
      if (data.contentId) {
        const asset = await this.assetService.getAssetById(data.contentId);
        if (asset && asset.dataUrl) {
          this.globalState.videoUrl = asset.dataUrl;
        } else {
          this.globalState.videoUrl = "";
        }
      }
    } else if (data.contentType === "html") {
      this.globalState.showHtmlModal = true;
      this.globalState.htmlContent = data.htmlString || "";
    }
  }

  private async handleHideContent(data: {
    contentType: "image" | "movie" | "html";
  }) {
    if (data.contentType === "image") {
      this.globalState.showImageModal = false;
    } else if (data.contentType === "movie") {
      this.globalState.showVideoModal = false;
    } else if (data.contentType === "html") {
      this.globalState.showHtmlModal = false;
      this.globalState.htmlContent = "";
    }
  }
}
