import { eventBus } from "../../../core/event-bus";

export class PlayAudioEventHandler {
  static register(audio: any, assetService: any) {
    eventBus.on("playAudio", (data: { audioId?: string }) =>
      this.handlePlayAudio(data, audio, assetService)
    );
    eventBus.on("stopAudio", () => this.handleStopAudio(audio));
  }

  private static async handlePlayAudio(
    data: { audioId?: string },
    audio: any,
    assetService: any
  ) {
    if (data.audioId) {
      const asset = await assetService.getAssetById(data.audioId);
      if (asset && asset.dataUrl) {
        await audio.load(asset.dataUrl);
        await audio.play();
      }
    }
  }

  private static async handleStopAudio(audio: any) {
    await audio.stop();
  }
}
