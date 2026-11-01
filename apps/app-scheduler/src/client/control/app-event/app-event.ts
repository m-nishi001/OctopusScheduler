import { container } from "tsyringe";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { toDateOrNow, toDateOrNull } from "@octopus/client-common/date-utils/date-utils";
import type { AppEventData } from "@model/app-event/app-event-data";
import type { AppEventDto } from "./dto/app-event-dto";
import { AudioControl } from "../media/audio";
import { ScreenControl } from "../media/screen";
import { parseScreenSpec } from "@model/media/screen-spec";

/**
 * 予定イベント。保存形(`AppEventData`)がそのまま実行時の型でもある。
 * 種類ごとの違いは下の `RUNNERS` と `EMPTY_FIELDS` の表だけにある。
 */
export type AppEvent = AppEventData;
export type AppEventType = AppEvent["type"];
type EventOf<T extends AppEventType> = Extract<AppEvent, { type: T }>;

/** 予定の時刻と記録用の日時(種類によらず共通のフィールド)。 */
export type AppEventTiming = Pick<AppEvent, "id" | "startTime" | "endTime" | "processedAt" | "registeredAt" | "updatedAt">;

/** 種類ごとの実行。`isStart` は開始(true)か終了(false)か。音楽・スクリーンは、単体機能を直接呼ぶ。 */
const RUNNERS: { [T in AppEventType]: (ev: EventOf<T>, isStart: boolean) => void | Promise<void> } = {
  AudioEvent: (ev, isStart) => {
    const audio = container.resolve(AudioControl);
    return isStart ? audio.play(ev.audioId) : audio.stop(ev.audioId, ev.fadeOutSec);
  },
  ScreenEvent: (ev, isStart) => {
    const screen = container.resolve(ScreenControl);
    return isStart ? screen.show(ev.spec) : screen.clear();
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
  await (RUNNERS[ev.type] as (ev: AppEvent, isStart: boolean) => void | Promise<void>)(ev, isStart);
}

/** 新規作成フォームの初期値(種類ごとの固有フィールド)。 */
const EMPTY_FIELDS: { [T in AppEventType]: Omit<EventOf<T>, keyof AppEventTiming | "type"> } = {
  AudioEvent: { audioId: "", fadeOutSec: 0 },
  ScreenEvent: { spec: { kind: "image", id: "" } },
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

/**
 * 保存先から読んだデータの日時を `Date` にそろえる。
 * 今の種類でないもの(以前の版の種類)や、中身が正しくないスクリーンの指定は、例外にする(読み込み側が捨てる)。
 */
export function reviveAppEvent(raw: AppEventData): AppEvent {
  if (!(raw.type in EMPTY_FIELDS)) throw new Error(`未知の予定イベントの種類です: ${String((raw as { type?: unknown }).type)}`);
  const ev: AppEvent = {
    ...raw,
    startTime: toDateOrNow(raw.startTime),
    endTime: toDateOrNow(raw.endTime),
    processedAt: toDateOrNull(raw.processedAt),
    registeredAt: toDateOrNow(raw.registeredAt),
    updatedAt: toDateOrNow(raw.updatedAt),
  };
  if (ev.type === "ScreenEvent") {
    const spec = parseScreenSpec(ev.spec);
    if (!spec) throw new Error("スクリーンの指定が正しくありません");
    ev.spec = spec;
  }
  return ev;
}

/**
 * フォームの DTO から、保存・実行できるイベントを作る。
 */
export function appEventFromDto(dto: AppEventDto, timing: AppEventTiming): AppEvent {
  const { actionType, id: _id, ...fields } = dto;
  return { ...fields, type: actionType, ...timing } as AppEvent;
}

/** イベントを、編集フォームが扱う DTO(時刻と記録用の日時を除いた形)にする。 */
export function appEventToDto(ev: AppEvent): AppEventDto {
  const { type, id, startTime: _s, endTime: _e, processedAt: _p, registeredAt: _r, updatedAt: _u, ...fields } = ev;
  return { actionType: type, id, ...fields } as AppEventDto;
}
