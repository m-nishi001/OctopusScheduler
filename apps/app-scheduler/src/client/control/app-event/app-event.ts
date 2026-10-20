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

/** 種類ごとの実行。`isStart` は開始(true)か終了(false)か、`manual` は手動操作(コンテンツ表示は、終了の操作があるまで出したままにする)。 */
const RUNNERS: { [T in AppEventType]: (ev: EventOf<T>, isStart: boolean, manual: boolean) => void } = {
  PlayAudioEvent: (ev, isStart) => {
    if (isStart) eventBus.emit("playAudio", { audioId: ev.audioId });
    else eventBus.emit("stopAudio");
  },
  StopAudioEvent: (ev, isStart) => {
    if (isStart) eventBus.emit("stopAudio", { audioId: ev.audioId, fadeOutDuration: ev.fadeOutDuration });
  },
  ShowContentEvent: (ev, isStart, manual) => {
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
        manual,
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
 * @param manual 手動操作か(コンテンツ表示だけが使う。true なら終了の操作があるまで出したままにする)
 */
export async function executeAppEvent(ev: AppEvent, isStart: boolean, manual = false): Promise<void> {
  (RUNNERS[ev.type] as (ev: AppEvent, isStart: boolean, manual: boolean) => void)(ev, isStart, manual);
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
 * フォーム/ショートカットの DTO から、保存・実行できるイベントを作る。
 * `timing` を省略すると「今すぐ実行する1秒のイベント」になる(ショートカットなど、予定せず直接実行する用)。
 */
export function appEventFromDto(dto: AppEventDto, timing?: AppEventTiming): AppEvent {
  const { actionType, id, ...fields } = dto;
  const now = new Date();
  const ev = {
    ...fields,
    type: actionType,
    ...(timing ?? {
      id: id ?? "",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    }),
  } as AppEvent;
  if (ev.type === "SlideshowEvent") {
    ev.transitionType ??= "fade";
    ev.bgmIds ??= [];
  }
  return ev;
}

/** イベントを、編集フォーム/ショートカットが扱う DTO(時刻と記録用の日時を除いた形)にする。 */
export function appEventToDto(ev: AppEvent): AppEventDto {
  const { type, id, startTime: _s, endTime: _e, processedAt: _p, registeredAt: _r, updatedAt: _u, ...fields } = ev;
  return { actionType: type, id, ...fields } as AppEventDto;
}
