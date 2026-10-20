import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eventBus } from "@octopus/client-common/events/event-bus";
import type { AppEventRepository } from "@model/app-event/app-event-repository";
import type { AppEventData } from "@model/app-event/app-event-data";
import type { AssetService } from "../asset/asset-service";
import {
  appEventFromDto,
  appEventToDto,
  createEmptyAppEvent,
  executeAppEvent,
  reviveAppEvent,
  type AppEventType,
} from "./app-event";
import { AppEventService } from "./app-event-service";
import type { AppEventDto } from "./dto/app-event-dto";

const TYPES: AppEventType[] = ["PlayAudioEvent", "StopAudioEvent", "ShowContentEvent", "SlideshowEvent", "TransitionPageEvent"];

/** 種類ごとの、すべてのフィールドを埋めた DTO。往復で欠けないことを見る。 */
const FULL_DTOS: { [T in AppEventType]: Extract<AppEventDto, { actionType: T }> } = {
  PlayAudioEvent: { actionType: "PlayAudioEvent", id: "e1", audioId: "a1", fadeOutDuration: 2 },
  StopAudioEvent: { actionType: "StopAudioEvent", id: "e2", audioId: "a2", fadeOutDuration: 3 },
  ShowContentEvent: {
    actionType: "ShowContentEvent",
    id: "e3",
    contentType: "html",
    contentId: "c1",
    htmlString: "<p>hi</p>",
    fadeOutDuration: 1,
    displayMode: "scroll-up",
    effect: "scroll",
    duration: 4,
    fadeInTime: 0.5,
    fadeOutTime: 0.7,
    scrollDirection: "left",
  },
  SlideshowEvent: {
    actionType: "SlideshowEvent",
    id: "e4",
    folderId: "f1",
    displayDuration: 6,
    transitionType: "slide",
    slideDirection: "up",
    bgmIds: ["b1", "b2"],
  },
  TransitionPageEvent: { actionType: "TransitionPageEvent", id: "e5", transitionUrl: "/p", fadeOutDuration: 1 },
};

type BusName = "playAudio" | "stopAudio" | "showContent" | "hideContent" | "startSlideshow" | "stopSlideshow" | "transitionPage";

const listen = (name: BusName) => {
  const spy = vi.fn();
  eventBus.on(name as "playAudio", spy);
  return spy;
};

afterEach(() => {
  eventBus.all.clear();
});

describe("executeAppEvent", () => {
  it("音楽再生: 開始で再生、終了で全停止", async () => {
    const play = listen("playAudio");
    const stop = listen("stopAudio");
    const ev = appEventFromDto(FULL_DTOS.PlayAudioEvent);
    await executeAppEvent(ev, true);
    expect(play).toHaveBeenCalledWith({ audioId: "a1" });
    await executeAppEvent(ev, false);
    expect(stop).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledWith(undefined);
  });

  it("音楽停止: 開始でだけ音声とフェードアウトを指定して止める。終了では何もしない", async () => {
    const stop = listen("stopAudio");
    const ev = appEventFromDto(FULL_DTOS.StopAudioEvent);
    await executeAppEvent(ev, true);
    expect(stop).toHaveBeenCalledWith({ audioId: "a2", fadeOutDuration: 3 });
    await executeAppEvent(ev, false);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("コンテンツ表示: 開始で表示(手動かどうかを伝える)、終了で種類を指定して隠す", async () => {
    const show = listen("showContent");
    const hide = listen("hideContent");
    const ev = appEventFromDto(FULL_DTOS.ShowContentEvent);
    await executeAppEvent(ev, true);
    await executeAppEvent(ev, true, true);
    expect(show.mock.calls[0][0]).toMatchObject({ eventId: "e3", contentType: "html", htmlString: "<p>hi</p>", duration: 4, manual: false });
    expect(show.mock.calls[1][0]).toMatchObject({ manual: true });
    await executeAppEvent(ev, false);
    expect(hide).toHaveBeenCalledWith({ contentType: "html" });
  });

  it("スライドショー: 開始で始め、終了で止める", async () => {
    const start = listen("startSlideshow");
    const stop = listen("stopSlideshow");
    const ev = appEventFromDto(FULL_DTOS.SlideshowEvent);
    await executeAppEvent(ev, true);
    expect(start).toHaveBeenCalledWith({ folderId: "f1", displayDuration: 6, transitionType: "slide", slideDirection: "up", bgmIds: ["b1", "b2"] });
    await executeAppEvent(ev, false);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("画面遷移: 開始でだけ遷移する", async () => {
    const go = listen("transitionPage");
    const ev = appEventFromDto(FULL_DTOS.TransitionPageEvent);
    await executeAppEvent(ev, true);
    expect(go).toHaveBeenCalledWith({ transitionUrl: "/p" });
    await executeAppEvent(ev, false);
    expect(go).toHaveBeenCalledOnce();
  });
});

describe("createEmptyAppEvent", () => {
  it.each(TYPES)("%s: 種類・1分の枠・未処理で作る", (type) => {
    const ev = createEmptyAppEvent(type);
    expect(ev.type).toBe(type);
    expect(ev.id).toBe("");
    expect(ev.endTime.getTime() - ev.startTime.getTime()).toBe(60_000);
    expect(ev.processedAt).toBeNull();
  });

  it("配列などの初期値は呼び出しごとに別物(1つを書き換えても他に移らない)", () => {
    const a = createEmptyAppEvent("SlideshowEvent");
    a.bgmIds.push("x");
    expect(createEmptyAppEvent("SlideshowEvent").bgmIds).toEqual([]);
  });
});

describe("DTO との変換", () => {
  it.each(TYPES)("%s: DTO → イベント → DTO で欠けない", (type) => {
    const dto = FULL_DTOS[type];
    expect(appEventToDto(appEventFromDto(dto))).toEqual(dto);
  });

  it("時刻を渡さなければ『今すぐ実行する1秒のイベント』、渡せばその時刻と記録を使う", () => {
    const direct = appEventFromDto(FULL_DTOS.PlayAudioEvent);
    expect(direct.endTime.getTime() - direct.startTime.getTime()).toBe(1000);
    expect(direct.processedAt).toBeNull();

    const timing = {
      id: "keep",
      startTime: new Date("2026-01-01T00:00:00Z"),
      endTime: new Date("2026-01-01T01:00:00Z"),
      processedAt: new Date("2026-01-01T00:00:05Z"),
      registeredAt: new Date("2025-12-31T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    };
    expect(appEventFromDto(FULL_DTOS.PlayAudioEvent, timing)).toMatchObject({ type: "PlayAudioEvent", audioId: "a1", ...timing });
  });

  it("スライドショーの省略された値は既定で補う", () => {
    const ev = appEventFromDto({ actionType: "SlideshowEvent", folderId: "f", displayDuration: 3 });
    expect(ev).toMatchObject({ transitionType: "fade", bgmIds: [] });
  });
});

describe("reviveAppEvent", () => {
  it("文字列で入っていた日時を Date にし、無い bgmIds は空にする", () => {
    const raw = {
      ...createEmptyAppEvent("SlideshowEvent"),
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-01T01:00:00.000Z",
      processedAt: "2026-01-01T00:00:01.000Z",
      bgmIds: undefined,
    } as unknown as AppEventData;
    const ev = reviveAppEvent(raw);
    expect(ev.startTime).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(ev.processedAt).toEqual(new Date("2026-01-01T00:00:01.000Z"));
    expect(ev.type === "SlideshowEvent" && ev.bgmIds).toEqual([]);
  });
});

describe("AppEventService.saveScheduledEvent", () => {
  const makeService = () => {
    const stored = new Map<string, AppEventData>();
    const repository = {
      addScheduleEvents: vi.fn(async (events: AppEventData[]) =>
        events.map((e) => {
          const id = `new-${stored.size + 1}`;
          stored.set(id, { ...e, id });
          return id;
        })
      ),
      updateScheduleEvents: vi.fn(async (events: AppEventData[]) => {
        for (const e of events) stored.set(e.id, e);
      }),
      getScheduleEvents: vi.fn(async () => [...stored.values()]),
    } as unknown as AppEventRepository;
    return { service: new AppEventService(repository, {} as AssetService), stored, repository };
  };

  const start = new Date("2026-03-01T10:00:00Z");
  const end = new Date("2026-03-01T11:00:00Z");

  it("新規は、指定の時刻・未処理・今の登録日時で追加する", async () => {
    const { service, stored } = makeService();
    await service.saveScheduledEvent({ ...FULL_DTOS.TransitionPageEvent, id: undefined, startTime: start, endTime: end });
    const [saved] = [...stored.values()];
    expect(saved).toMatchObject({ type: "TransitionPageEvent", transitionUrl: "/p", startTime: start, endTime: end, processedAt: null });
    expect(saved.id).toBe("new-1");
  });

  it("編集は id・処理済み日時・登録日時を引き継ぎ、時刻と中身だけ更新する", async () => {
    const { service, stored } = makeService();
    const existing = {
      ...createEmptyAppEvent("PlayAudioEvent"),
      id: "ev-1",
      audioId: "old",
      processedAt: new Date("2026-02-01T00:00:00Z"),
      registeredAt: new Date("2026-01-01T00:00:00Z"),
    };
    await service.saveScheduledEvent({ actionType: "PlayAudioEvent", audioId: "new", fadeOutDuration: 1, startTime: start, endTime: end }, existing);
    expect(stored.get("ev-1")).toMatchObject({
      type: "PlayAudioEvent",
      audioId: "new",
      fadeOutDuration: 1,
      startTime: start,
      endTime: end,
      processedAt: existing.processedAt,
      registeredAt: existing.registeredAt,
    });
    expect(stored.get("ev-1")).not.toHaveProperty("actionType");
  });
});
