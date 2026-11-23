import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  deleteScheduleEvents,
  getScheduleEvents,
  importScheduleEvents,
  markScheduleEvents,
  saveScheduleEvent,
} from "../../../server/schedule-events-use-cases";
import type { OctopusSchedulerApi } from "../../../server/scheduler-api-contract";
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

/** サーバー(メモリ上の保存先に、サーバーと同じ操作を適用する)を、通信の失敗も含めて再現した API。 */
function fakeServer() {
  const deps = { storage: new InMemoryKeyValueStorage() };
  const state = { offline: false, calls: [] as string[] };
  const guard = <A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
    state.calls.push(name);
    if (state.offline) throw new Error("network down");
    return fn(...args);
  };
  const api = {
    getScheduleEvents: guard("get", () => getScheduleEvents(deps)),
    saveScheduleEvent: guard("save", (a: Parameters<OctopusSchedulerApi["saveScheduleEvent"]>[0]) => saveScheduleEvent(deps, a)),
    deleteScheduleEvents: guard("delete", (a: Parameters<OctopusSchedulerApi["deleteScheduleEvents"]>[0]) => deleteScheduleEvents(deps, a)),
    importScheduleEvents: guard("import", (a: Parameters<OctopusSchedulerApi["importScheduleEvents"]>[0]) => importScheduleEvents(deps, a)),
    markScheduleEvents: guard("mark", (a: Parameters<OctopusSchedulerApi["markScheduleEvents"]>[0]) => markScheduleEvents(deps, a)),
  } as unknown as OctopusSchedulerApi;
  return { api, state };
}

describe("AppEventRepository(正はサーバー、端末はキャッシュ)", () => {
  let server: ReturnType<typeof fakeServer>;
  let repo: AppEventRepository;
  beforeEach(async () => {
    await new LocalStorageService("octopus-scheduler", "ScheduleEventsRecord").clear();
    server = fakeServer();
    repo = new AppEventRepository(server.api);
  });

  it("保存したイベントは、別の端末(別のリポジトリ)からも、日時が Date のまま読める", async () => {
    await repo.saveScheduleEvent(event("a", 2));
    const other = new AppEventRepository(server.api);
    const [got] = await other.getScheduleEvents();
    expect(got).toMatchObject({ id: "a", fadeOutSec: 2 });
    expect(got.startTime).toEqual(new Date(2026, 10, 2, 9));
    expect(got.processedAt).toBeNull();
  });

  it("取込: 追加・更新をまとめて書き、消すイベントは実行状態ごと消す(残りのイベントの状態は残す)", async () => {
    await repo.applyImport([event("keep"), event("edit"), event("gone")], []);
    await repo.markScheduleEvents(["gone"], "completed");
    await repo.markScheduleEvents(["keep"], "running");

    await repo.applyImport([event("edit", 3), event("new")], ["gone"]);

    const events = await repo.getScheduleEvents();
    expect(events.map((e) => e.id).sort()).toEqual(["edit", "keep", "new"]);
    expect(events.find((e) => e.id === "edit")).toMatchObject({ fadeOutSec: 3 });
    expect(await repo.getExecutionStatus("gone")).toBeNull();
    expect(await repo.getExecutionStatus("keep")).toBe("running");
  });

  it("何も無ければサーバーに何も送らない", async () => {
    await repo.applyImport([], []);
    await repo.deleteScheduleEvents([]);
    await repo.markScheduleEvents([], "running");
    expect(server.state.calls).toEqual([]);
  });

  it("実行状態は別の端末にも見え、イベントの編集で失われない", async () => {
    await repo.saveScheduleEvent(event("a"));
    await repo.markScheduleEvents(["a"], "running");
    const other = new AppEventRepository(server.api);
    await other.saveScheduleEvent(event("a", 9));
    const snapshot = await repo.getSnapshot();
    expect(snapshot.status).toEqual({ a: "running" });
    expect(snapshot.events[0]).toMatchObject({ fadeOutSec: 9 });
    expect(snapshot.events[0].processedAt).toBeInstanceOf(Date);
  });

  it("取得に失敗したら、最後に取得した内容(キャッシュ)で動く。キャッシュも無ければ例外", async () => {
    await expect(repo.getScheduleEvents().then(() => repo.getSnapshot())).resolves.toBeTruthy();
    await repo.saveScheduleEvent(event("a"));
    await repo.markScheduleEvents(["a"], "running");
    server.state.offline = true;
    expect((await repo.getScheduleEvents()).map((e) => e.id)).toEqual(["a"]);
    expect((await repo.getSnapshot()).status).toEqual({ a: "running" });

    await new LocalStorageService("octopus-scheduler", "ScheduleEventsRecord").clear();
    await expect(repo.getScheduleEvents()).rejects.toThrow("network down");
  });

  it("書き込みは、通信できなければ例外(サーバーに入っていないのに保存できたように見せない)", async () => {
    server.state.offline = true;
    await expect(repo.saveScheduleEvent(event("a"))).rejects.toThrow("network down");
  });

  it("refresh は読むだけ(サーバーに書かない)で、失敗しても例外にしない。古い端末内のストアは読まない", async () => {
    await new LocalStorageService("octopus-scheduler", "ScheduleEventData").save("old", event("old"));
    await repo.saveScheduleEvent(event("a"));
    server.state.calls.length = 0;
    await repo.refresh();
    expect(server.state.calls).toEqual(["get"]);
    server.state.offline = true;
    await expect(repo.refresh()).resolves.toBeUndefined();
    expect((await repo.getScheduleEvents()).map((e) => e.id)).toEqual(["a"]);
  });
});
