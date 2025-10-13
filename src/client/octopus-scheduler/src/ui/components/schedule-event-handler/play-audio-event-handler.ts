import { eventBus } from "../../../core/event-bus";

export class PlayAudioEventHandler {
  constructor(
    private audio: any,
    private assetService: any
  ) {
    eventBus.on("playAudio", this.handlePlayAudio.bind(this));
    eventBus.on("stopAudio", this.handleStopAudio.bind(this));
  }

  private async handlePlayAudio(data: { audioId?: string }) {
    if (data.audioId) {
      const asset = await this.assetService.getAssetById(data.audioId);
      if (asset && asset.dataUrl) {
        await this.audio.load(asset.dataUrl);
        await this.audio.play();
      }
    }
  }

  private async handleStopAudio() {
    await this.audio.stop();
  }
}
