import { handleVideoEvent } from "./videoHandler";
import { handleImageEvent } from "./imageHandler";
import { handleMusicEvent } from "./musicHandler";
import { handleTransitionEvent } from "./transitionHandler";
import { VideoDetail } from "../domains/schedule/vo/event-details/video-detail";
import { ImageDetail } from "../domains/schedule/vo/event-details/image-detail";
import { AudioDetail } from "../domains/schedule/vo/event-details/audio-detail";
import { TransitionDetail } from "../domains/schedule/vo/event-details/transition-detail";

// eventType→ハンドラのマップ
export const eventHandlers: Record<string, (eventDetail: any) => void> = {
  video: (detail: any) => handleVideoEvent(detail as VideoDetail),
  image: (detail: any) => handleImageEvent(detail as ImageDetail),
  music: (detail: any) => handleMusicEvent(detail as AudioDetail),
  transition: (detail: any) => handleTransitionEvent(detail as TransitionDetail),
};
