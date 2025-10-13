import { eventBus } from "../../../../core/event-bus";

export class PlayAudioEventHandler {
  constructor(
    private globalState: any,
    private assetService: any
  ) {
    eventBus.on("playAudio", this.handlePlayAudio.bind(this));
    eventBus.on("stopAudio", this.handleStopAudio.bind(this));
  }

  private async handlePlayAudio(data: { audioId?: string }) {
    this.globalState.isAudioPlaying = true;
    if (data.audioId) {
      const asset = await this.assetService.getAssetById(data.audioId);
      if (asset && asset.dataUrl) {
        this.globalState.audioUrl = asset.dataUrl;
      } else {
        this.globalState.audioUrl = "";
      }
    }
  }

  private async handleStopAudio() {
    this.globalState.isAudioPlaying = false;
  }
}
