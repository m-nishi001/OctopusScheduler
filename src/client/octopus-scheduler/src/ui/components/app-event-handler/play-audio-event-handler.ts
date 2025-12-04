import { eventBus } from "../../../core/event-bus";
import { AudioService } from "@common-lib/audio/audio-service";
import { container } from "tsyringe";
import { AssetService } from "../../../model/applications/assets/asset-service";

export class PlayAudioEventHandler {
  private static audioService = new AudioService();
  private static playingInstances = new Map<string, string>();

  static register() {
    const assetService = container.resolve(AssetService);
    eventBus.on("playAudio", (data: { audioId?: string }) =>
      this.handlePlayAudio(data, assetService)
    );
    eventBus.on(
      "stopAudio",
      (data?: { audioId?: string; fadeOutDuration?: number }) =>
        this.handleStopAudio(data)
    );
  }

  private static async handlePlayAudio(
    data: { audioId?: string },
    assetService: any
  ) {
    if (data.audioId) {
      try {
        const asset = await assetService.getAssetById(data.audioId);
        if (asset) {
          let url: string | undefined;
          let createdUrl: string | undefined;
          if ((asset as any).blob) {
            try {
              createdUrl = URL.createObjectURL((asset as any).blob);
              url = createdUrl;
            } catch (err) {
              console.error("Failed to create object URL for audio", err);
            }
          }
          if (url) {
            const instanceId = await this.audioService.loadFromUrl(url);
            await this.audioService.play(instanceId);
            this.playingInstances.set(data.audioId, instanceId);
            if (createdUrl) {
              // schedule revoke after short delay to ensure loaded by audio service
              setTimeout(() => {
                try {
                  URL.revokeObjectURL(createdUrl!);
                } catch (e) {}
              }, 1000);
            }
          }
        }
      } catch (error) {
        console.error("Failed to play audio:", error);
      }
    }
  }

  private static async handleStopAudio(data?: {
    audioId?: string;
    fadeOutDuration?: number;
  }) {
    const fadeMs = data?.fadeOutDuration
      ? Math.round((data.fadeOutDuration as number) * 1000)
      : 0;
    if (data?.audioId) {
      const instance = this.playingInstances.get(data.audioId);
      if (instance) {
        try {
          await this.audioService.stop(instance, fadeMs);
          this.audioService.disposeInstance(instance);
        } catch (error) {
          console.error("Failed to stop audio:", error);
        }
        this.playingInstances.delete(data.audioId);
      }
      return;
    }

    for (const instanceId of this.playingInstances.values()) {
      try {
        await this.audioService.stop(instanceId, fadeMs);
        this.audioService.disposeInstance(instanceId);
      } catch (error) {
        console.error("Failed to stop audio:", error);
      }
    }
    this.playingInstances.clear();
  }
}
