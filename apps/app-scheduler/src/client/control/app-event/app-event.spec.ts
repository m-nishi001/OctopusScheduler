import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventBus } from "@octopus/client-common/events/event-bus";
import type { AppEventRepository } from "@model/app-event/app-event-repository";
import type { AppEventData } from "@model/app-event/app-event-data";
import { container } from "tsyringe";
import { AudioControl } from "../media/audio";
import { ScreenControl } from "../media/screen";
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

const TYPES: AppEventType[] = ["AudioEvent", "ScreenEvent", "TransitionPageEvent"];

/** 種類ごとの、すべてのフィールドを埋めた DTO。往復で欠けないことを見る。 */
const FULL_DTOS: { [T in AppEventType]: Extract<AppEventDto, { actionType: T }> } = {
  AudioEvent: { actionType: "AudioEvent", id: "e1", audioId: "a1", fadeOutSec: 2 },
  ScreenEvent: { actionType: "ScreenEvent", id: "e2", spec: { kind: "slideshow", folder: "f1", intervalSec: 6, transition: "slide" } },
  TransitionPageEvent: { actionType: "TransitionPageEvent", id: "e5", transitionUrl: "/p", fadeOutDuration: 1 },
};

const fromDto = (dto: Parameters<typeof appEventFromDto>[0]) =>
  appEventFromDto(dto, {
    id: dto.id ?? "",
    startTime: new Date("2026-01-01T00:00:00Z"),
    endTime: new Date("2026-01-01T00:00:01Z"),
    processedAt: null,
    registeredAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });

const audio = { play: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
const screen = { show: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) };

beforeEach(() => {
  vi.clearAllMocks();
  container.registerInstance(AudioControl, audio as unknown as AudioControl);
  container.registerInstance(ScreenControl, screen as unknown as ScreenControl);
});

afterEach(() => {
  eventBus.all.clear();
});

describe("executeAppEvent", () => {
  it("音楽: 開始で再生、終了でフェードアウトして止める", async () => {
    const ev = fromDto(FULL_DTOS.AudioEvent);
    await executeAppEvent(ev, true);
    expect(audio.play).toHaveBeenCalledWith("a1");
    expect(audio.stop).not.toHaveBeenCalled();
    await executeAppEvent(ev, false);
    expect(audio.stop).toHaveBeenCalledWith("a1", 2);
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("スクリーン: 開始で指定のものを表示、終了で消す", async () => {
    const ev = fromDto(FULL_DTOS.ScreenEvent);
    await executeAppEvent(ev, true);
    expect(screen.show).toHaveBeenCalledWith({ kind: "slideshow", folder: "f1", intervalSec: 6, transition: "slide" });
    expect(screen.clear).not.toHaveBeenCalled();
    await executeAppEvent(ev, false);
    expect(screen.clear).toHaveBeenCalledOnce();
  });

  it("画面遷移: 開始でだけ遷移する", async () => {
    const go = vi.fn();
    eventBus.on("transitionPage", go);
    const ev = fromDto(FULL_DTOS.TransitionPageEvent);
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

  it("入れ子の初期値は呼び出しごとに別物(1つを書き換えても他に移らない)", () => {
    const a = createEmptyAppEvent("ScreenEvent");
    a.spec = { kind: "video", id: "x" };
    expect(createEmptyAppEvent("ScreenEvent").spec).toEqual({ kind: "image", id: "" });
  });
});

describe("DTO との変換", () => {
  it.each(TYPES)("%s: DTO → イベント → DTO で欠けない", (type) => {
    const dto = FULL_DTOS[type];
    expect(appEventToDto(fromDto(dto))).toEqual(dto);
  });

  it("渡した時刻と記録をそのまま使う", () => {
    const timing = {
      id: "keep",
      startTime: new Date("2026-01-01T00:00:00Z"),
      endTime: new Date("2026-01-01T01:00:00Z"),
      processedAt: new Date("2026-01-01T00:00:05Z"),
      registeredAt: new Date("2025-12-31T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    };
    expect(appEventFromDto(FULL_DTOS.AudioEvent, timing)).toMatchObject({ type: "AudioEvent", audioId: "a1", ...timing });
  });
});

describe("reviveAppEvent", () => {
  it("文字列で入っていた日時を Date にする", () => {
    const raw = {
      ...createEmptyAppEvent("AudioEvent"),
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-01T01:00:00.000Z",
      processedAt: "2026-01-01T00:00:01.000Z",
    } as unknown as AppEventData;
    const ev = reviveAppEvent(raw);
    expect(ev.startTime).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(ev.processedAt).toEqual(new Date("2026-01-01T00:00:01.000Z"));
  });

  it("以前の版の種類は読み込めない(捨てる)", () => {
    for (const type of ["PlayAudioEvent", "StopAudioEvent", "ShowContentEvent", "SlideshowEvent"]) {
      expect(() => reviveAppEvent({ ...createEmptyAppEvent("AudioEvent"), type } as unknown as AppEventData)).toThrow();
    }
  });

  it("スクリーンの指定が正しくないものは読み込めない", () => {
    const raw = { ...createEmptyAppEvent("ScreenEvent"), spec: { kind: "html", id: "x" } } as unknown as AppEventData;
    expect(() => reviveAppEvent(raw)).toThrow();
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
    return { service: new AppEventService(repository), stored, repository };
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
      ...createEmptyAppEvent("AudioEvent"),
      id: "ev-1",
      audioId: "old",
      processedAt: new Date("2026-02-01T00:00:00Z"),
      registeredAt: new Date("2026-01-01T00:00:00Z"),
    };
    await service.saveScheduledEvent({ actionType: "AudioEvent", audioId: "new", fadeOutSec: 1, startTime: start, endTime: end }, existing);
    expect(stored.get("ev-1")).toMatchObject({
      type: "AudioEvent",
      audioId: "new",
      fadeOutSec: 1,
      startTime: start,
      endTime: end,
      processedAt: existing.processedAt,
      registeredAt: existing.registeredAt,
    });
    expect(stored.get("ev-1")).not.toHaveProperty("actionType");
  });
});
