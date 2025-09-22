import { reactive } from 'vue';
import { container } from 'tsyringe';
import type { IScheduleEventService } from './schedule-event/ischedule-event-service';
import type { EventDto } from './schedule-event/dtos/event-dto';
import type { AssetService } from './assets/asset-service';

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
        upcomingEvent: '',
        currentEvent: '',
        endingEvent: '',
        audioUrl: '',
        videoUrl: '',
        imageAssetUrl: '',
        showVideoModal: false,
        showImageModal: false,
        isAudioPlaying: false,
        audioError: null,
        nextPage: null,
        isPolling: false,
    });

    private pollingTimer: any = null;
    private scheduleEventService = container.resolve<IScheduleEventService>('IScheduleEventService');
    private assetService = container.resolve<AssetService>('AssetService');

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
        const { startEvents, endEvents } = await this.scheduleEventService.getCurrentScheduleEvent();
        this.state.upcomingEvent = startEvents.length > 0 ? startEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';
        this.state.currentEvent = startEvents.length > 0 ? startEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';
        this.state.endingEvent = endEvents.length > 0 ? endEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';

        for (const event of startEvents) {
            await this.executeStrategy(event, 'start');
        }
        for (const event of endEvents) {
            await this.executeStrategy(event, 'end');
        }

        if (startEvents.length > 0) {
            await this.scheduleEventService.markEventsAsStarted({ scheduleEventIds: startEvents.map(e => e.scheduleEventId) });
        }
        if (endEvents.length > 0) {
            await this.scheduleEventService.markEventsAsEnded({ scheduleEventIds: endEvents.map(e => e.scheduleEventId) });
        }
    }

    async executeStrategy(event: EventDto, method: 'start' | 'end') {
        const type = event.scheduleEventType;
        if (type === 'PlayAudioEvent') {
            if (method === 'start') await this.playAudio(event);
            else await this.stopAudio();
        } else if (type === 'PlayMovieEvent') {
            if (method === 'start') await this.showVideo(event);
            else await this.hideVideo();
        } else if (type === 'ShowImageEvent') {
            if (method === 'start') await this.showImage(event);
            else await this.hideImage();
        } else if (type === 'TransitionPageEvent') {
            if (method === 'start') {
                await this.transitionPage(event);
            }
        }
    }

    async playAudio(event?: EventDto) {
        this.state.isAudioPlaying = true;
        if (event?.scheduleEventDetail?.audioId) {
            const asset = await this.assetService.getAssetById(event.scheduleEventDetail.audioId);
            if (asset && asset.assetData) {
                this.state.audioUrl = URL.createObjectURL(asset.assetData);
            } else {
                this.state.audioUrl = '';
            }
        }
    }
    async stopAudio() {
        this.state.isAudioPlaying = false;
    }
    async showVideo(event?: EventDto) {
        this.state.showVideoModal = true;
        if (event?.scheduleEventDetail?.movieId) {
            const asset = await this.assetService.getAssetById(event.scheduleEventDetail.movieId);
            if (asset && asset.assetData) {
                this.state.videoUrl = asset.assetData;
            } else {
                this.state.videoUrl = '';
            }
        }
    }
    async hideVideo() {
        this.state.showVideoModal = false;
    }
    async showImage(event?: EventDto) {
        this.state.showImageModal = true;
        if (event?.scheduleEventDetail?.imageId) {
            const asset = await this.assetService.getAssetById(event.scheduleEventDetail.imageId);
            if (asset && asset.assetData) {
                this.state.imageAssetUrl = asset.assetData;
            } else {
                this.state.imageAssetUrl = '';
            }
        }
    }
    async hideImage() {
        this.state.showImageModal = false;
    }
    async transitionPage(event: any) {
        if (event.scheduleEventDetail?.pageUrl) {
            this.state.nextPage = event.scheduleEventDetail.pageUrl;
        }
    }
}
