import { eventBus } from "@octopus/client-common/events/event-bus";
import { toDateOrNow, toDateOrNull } from "@octopus/client-common/date-utils/date-utils";
import type { AppEventData } from "@model/app-event/app-event-data";
import type { AppEventDto } from "./dto/app-event-dto";

/**
 * 予定イベント。保存形(`AppEventData`)がそのまま実行時の型でもある。
 * 種類ごとの違いは下の `RUNNERS` と `EMPTY_FIELDS` の表だけにある。
 */
export type AppEvent = AppEventData;
export type AppEventType = AppEvent["type"];
type EventOf<T extends AppEventType> = Extract<AppEvent, { type: T }>;

/** 予定の時刻と記録用の日時(種類によらず共通のフィールド)。 */
export type AppEventTiming = Pick<AppEvent, "id" | "startTime" | "endTime" | "processedAt" | "registeredAt" | "updatedAt">;

/** 種類ごとの実行。`isStart` は開始(true)か終了(false)か。 */
const RUNNERS: { [T in AppEventType]: (ev: EventOf<T>, isStart: boolean) => void } = {
  PlayAudioEvent: (ev, isStart) => {
    if (isStart) eventBus.emit("playAudio", { audioId: ev.audioId });
    else eventBus.emit("stopAudio");
  },
  StopAudioEvent: (ev, isStart) => {
    if (isStart) eventBus.emit("stopAudio", { audioId: ev.audioId, fadeOutDuration: ev.fadeOutDuration });
  },
  ShowContentEvent: (ev, isStart) => {
    if (isStart) {
      eventBus.emit("showContent", {
        eventId: ev.id,
        contentType: ev.contentType,
        contentId: ev.contentId,
        htmlString: ev.htmlString,
        displayMode: ev.displayMode,
        effect: ev.effect,
        duration: ev.duration,
        fadeInTime: ev.fadeInTime,
        fadeOutTime: ev.fadeOutTime,
        scrollDirection: ev.scrollDirection,
      });
    } else {
      eventBus.emit("hideContent", { contentType: ev.contentType });
    }
  },
  SlideshowEvent: (ev, isStart) => {
    if (isStart) {
      eventBus.emit("startSlideshow", {
        folderId: ev.folderId,
        displayDuration: ev.displayDuration,
        transitionType: ev.transitionType,
        slideDirection: ev.slideDirection,
        bgmIds: ev.bgmIds,
      });
    } else {
      eventBus.emit("stopSlideshow");
    }
  },
  TransitionPageEvent: (ev, isStart) => {
    if (isStart) eventBus.emit("transitionPage", { transitionUrl: ev.transitionUrl });
  },
};

/**
 * 予定イベントを実行する。
 * @param isStart 開始(true)か終了(false)か
 */
export async function executeAppEvent(ev: AppEvent, isStart: boolean): Promise<void> {
  (RUNNERS[ev.type] as (ev: AppEvent, isStart: boolean) => void)(ev, isStart);
}

/** 新規作成フォームの初期値(種類ごとの固有フィールド)。 */
const EMPTY_FIELDS: { [T in AppEventType]: Omit<EventOf<T>, keyof AppEventTiming | "type"> } = {
  PlayAudioEvent: { audioId: "", fadeOutDuration: 0 },
  StopAudioEvent: { audioId: undefined, fadeOutDuration: 0 },
  ShowContentEvent: {
    contentType: "image",
    contentId: "",
    htmlString: "",
    fadeOutDuration: 0,
    displayMode: "fade",
    effect: "fade",
    duration: 3,
    fadeInTime: 1,
    fadeOutTime: 1,
    scrollDirection: "up",
  },
  SlideshowEvent: { folderId: "", displayDuration: 5, transitionType: "fade", slideDirection: "left", bgmIds: [] },
  TransitionPageEvent: { transitionUrl: "", fadeOutDuration: 0 },
};

/** 新規作成フォーム用の、まだ保存していない空のイベント(開始は今、1分間)。 */
export function createEmptyAppEvent<T extends AppEventType>(type: T): EventOf<T> {
  const now = new Date();
  return {
    id: "",
    type,
    startTime: now,
    endTime: new Date(now.getTime() + 60_000),
    processedAt: null,
    registeredAt: now,
    updatedAt: now,
    ...structuredClone(EMPTY_FIELDS[type]),
  } as unknown as EventOf<T>;
}

/** 保存先から読んだデータの日時を `Date` にそろえ、省略されうる配列を補う。 */
export function reviveAppEvent(raw: AppEventData): AppEvent {
  const ev: AppEvent = {
    ...raw,
    startTime: toDateOrNow(raw.startTime),
    endTime: toDateOrNow(raw.endTime),
    processedAt: toDateOrNull(raw.processedAt),
    registeredAt: toDateOrNow(raw.registeredAt),
    updatedAt: toDateOrNow(raw.updatedAt),
  };
  if (ev.type === "SlideshowEvent") ev.bgmIds ??= [];
  return ev;
}

/**
 * フォームの DTO から、保存・実行できるイベントを作る。
 */
export function appEventFromDto(dto: AppEventDto, timing: AppEventTiming): AppEvent {
  const { actionType, id: _id, ...fields } = dto;
  const ev = {
    ...fields,
    type: actionType,
    ...timing,
  } as AppEvent;
  if (ev.type === "SlideshowEvent") {
    ev.transitionType ??= "fade";
    ev.bgmIds ??= [];
  }
  return ev;
}

/** イベントを、編集フォームが扱う DTO(時刻と記録用の日時を除いた形)にする。 */
export function appEventToDto(ev: AppEvent): AppEventDto {
  const { type, id, startTime: _s, endTime: _e, processedAt: _p, registeredAt: _r, updatedAt: _u, ...fields } = ev;
  return { actionType: type, id, ...fields } as AppEventDto;
}
