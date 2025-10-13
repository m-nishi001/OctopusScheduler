import { reactive } from "vue";
import { container } from "tsyringe";
import type { ScheduleEventService } from "./schedule-event/schedule-event-service";
import type { ScheduleEventDto } from "../domains/schedule-event/entity/schedule-event";
import type { AssetService } from "./assets/asset-service";

export interface EventPollingState {
  upcomingEvent: string;
  currentEvent: string;
  endingEvent: string;
  audioUrl: string;
  videoUrl: string;
  imageAssetUrl: string;
  showVideoModal: boolean;
  showImageModal: boolean;
  isAudioPlaying: boolean;
  audioError: any;
  nextPage: string | null;
  isPolling: boolean;
}

export class EventPollingService {
  public state = reactive<EventPollingState>({
    upcomingEvent: "",
    currentEvent: "",
    endingEvent: "",
    audioUrl: "",
    videoUrl: "",
    imageAssetUrl: "",
    showVideoModal: false,
    showImageModal: false,
    isAudioPlaying: false,
    audioError: null,
    nextPage: null,
    isPolling: false,
  });

  private pollingTimer: any = null;
  private scheduleEventService = container.resolve<ScheduleEventService>(
    "ScheduleEventService"
  );
  private assetService = container.resolve<AssetService>("AssetService");

  public startPolling(interval = 5000) {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(() => this.handleEvents(), interval);
    this.state.isPolling = true;
    this.handleEvents();
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.state.isPolling = false;
  }

  async handleEvents() {
    const { startEvents, endEvents } =
      await this.scheduleEventService.getCurrentScheduleEvent();
    this.state.upcomingEvent =
      startEvents.length > 0
        ? startEvents.map((e) => e.name).join(", ")
        : "（なし）";
    this.state.currentEvent =
      startEvents.length > 0
        ? startEvents.map((e) => e.name).join(", ")
        : "（なし）";
    this.state.endingEvent =
      endEvents.length > 0
        ? endEvents.map((e) => e.name).join(", ")
        : "（なし）";

    for (const event of startEvents) {
      await this.executeStrategy(event, "start");
    }
    for (const event of endEvents) {
      await this.executeStrategy(event, "end");
    }

    if (startEvents.length > 0) {
      await this.scheduleEventService.markEventsAsStarted(
        startEvents.map((e) => e.id)
      );
    }
    if (endEvents.length > 0) {
      await this.scheduleEventService.markEventsAsEnded(
        endEvents.map((e) => e.id)
      );
    }
  }

  async executeStrategy(event: ScheduleEventDto, method: "start" | "end") {
    const type = event.type;
    if (type === "PlayAudioEvent") {
      if (method === "start") await this.playAudio(event);
      else await this.stopAudio();
    } else if (type === "PlayMovieEvent") {
      if (method === "start") await this.showVideo(event);
      else await this.hideVideo();
    } else if (type === "ShowImageEvent") {
      if (method === "start") await this.showImage(event);
      else await this.hideImage();
    } else if (type === "TransitionPageEvent") {
      if (method === "start") {
        await this.transitionPage(event);
      }
    }
  }

  async playAudio(event?: ScheduleEventDto) {
    this.state.isAudioPlaying = true;
    if (event?.detail?.audioId) {
      const asset = await this.assetService.getAssetById(event.detail.audioId);
      if (asset && asset.dataUrl) {
        this.state.audioUrl = asset.dataUrl;
      } else {
        this.state.audioUrl = "";
      }
    }
  }
  async stopAudio() {
    this.state.isAudioPlaying = false;
  }
  async showVideo(event?: ScheduleEventDto) {
    this.state.showVideoModal = true;
    if (event?.detail?.movieId) {
      const asset = await this.assetService.getAssetById(event.detail.movieId);
      if (asset && asset.dataUrl) {
        this.state.videoUrl = asset.dataUrl;
      } else {
        this.state.videoUrl = "";
      }
    }
  }
  async hideVideo() {
    this.state.showVideoModal = false;
  }
  async showImage(event?: ScheduleEventDto) {
    this.state.showImageModal = true;
    if (event?.detail?.imageId) {
      const asset = await this.assetService.getAssetById(event.detail.imageId);
      if (asset && asset.dataUrl) {
        this.state.imageAssetUrl = asset.dataUrl;
      } else {
        this.state.imageAssetUrl = "";
      }
    }
  }
  async hideImage() {
    this.state.showImageModal = false;
  }
  async transitionPage(event: ScheduleEventDto) {
    if (event.detail?.pageUrl) {
      this.state.nextPage = event.detail.pageUrl;
    }
  }
}
