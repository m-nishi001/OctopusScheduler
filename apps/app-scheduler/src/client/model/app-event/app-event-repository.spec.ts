import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { AppEventData } from "./app-event-data";
import { AppEventRepository } from "./app-event-repository";

const event = (id: string, fadeOutSec = 0): AppEventData => ({
  id,
  type: "AudioEvent",
  startTime: new Date(2026, 10, 2, 9),
  endTime: new Date(2026, 10, 2, 10),
  audioId: "a1",
  fadeOutSec,
  processedAt: null,
  registeredAt: new Date(2026, 5, 5),
  updatedAt: new Date(2026, 5, 5),
});

describe("AppEventRepository.applyImport", () => {
  let repo: AppEventRepository;
  beforeEach(async () => {
    await new LocalStorageService("octopus-scheduler", "ScheduleEventData").clear();
    await new LocalStorageService("octopus-scheduler", "ScheduleEventExecutionStatus").clear();
    repo = new AppEventRepository();
  });

  it("追加・更新をまとめて書き、消すイベントは実行状態ごと消す(残りのイベントの状態は残す)", async () => {
    await repo.updateScheduleEvents([event("keep"), event("edit"), event("gone")]);
    await repo.updateExecutionStatus("gone", "completed");
    await repo.updateExecutionStatus("keep", "running");

    await repo.applyImport([event("edit", 3), event("new")], ["gone"]);

    const events = await repo.getScheduleEvents();
    expect(events.map((e) => e.id).sort()).toEqual(["edit", "keep", "new"]);
    expect(events.find((e) => e.id === "edit")).toMatchObject({ fadeOutSec: 3 });
    expect(await repo.getExecutionStatus("gone")).toBeNull();
    expect(await repo.getExecutionStatus("keep")).toBe("running");
  });

  it("何も無ければ何も変えない", async () => {
    await repo.updateScheduleEvents([event("a")]);
    await repo.applyImport([], []);
    expect((await repo.getScheduleEvents()).map((e) => e.id)).toEqual(["a"]);
  });
});
