import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import type { ILock } from "@octopus/infrastructures/interfaces";
import {
  applyDeleteEvents,
  applyImportEvents,
  applyMarkEvents,
  applySaveEvent,
  emptyScheduleRecord,
  parseScheduleRecord,
} from "../schedule-events-record";
import {
  deleteScheduleEvents,
  getScheduleEvents,
  importScheduleEvents,
  markScheduleEvents,
  saveScheduleEvent,
} from "../schedule-events-use-cases";
import type { ScheduleEventJson } from "../scheduler-api-contract";

const NOW = "2026-11-02T00:00:00.000Z";
const event = (id: string, extra: Partial<ScheduleEventJson> = {}): ScheduleEventJson => ({
  id,
  type: "AudioEvent",
  startTime: "2026-11-02T09:00:00.000Z",
  endTime: "2026-11-02T10:00:00.000Z",
  audioId: "a1",
  fadeOutSec: 0,
  processedAt: null,
  registeredAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
  ...extra,
});

describe("予定イベントの操作(純粋)", () => {
  it("まだ無い保存は空。壊れた保存は、空と取り違えずに例外", () => {
    expect(parseScheduleRecord(null)).toEqual(emptyScheduleRecord());
    expect(() => parseScheduleRecord("not json")).toThrow();
    expect(() => parseScheduleRecord(JSON.stringify({ version: 9 }))).toThrow();
  });

  it("作成: 新しい id は追加、同じ id は中身を入れ替えるが処理済み日時・登録日時は保つ", () => {
    let r = applySaveEvent(emptyScheduleRecord(), event("a", { processedAt: NOW }));
    expect(r.events).toHaveLength(1);
    r = applySaveEvent(r, event("a", { audioId: "a2", processedAt: null, registeredAt: "2030-01-01T00:00:00.000Z" }));
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ audioId: "a2", processedAt: NOW, registeredAt: "2026-06-05T00:00:00.000Z" });
  });

  it("形の違うイベントは断る", () => {
    expect(() => applySaveEvent(emptyScheduleRecord(), { ...event("a"), startTime: "xx" })).toThrow(/startTime/);
    expect(() => applySaveEvent(emptyScheduleRecord(), { ...event("a"), id: "" })).toThrow(/id/);
    expect(() => applySaveEvent(emptyScheduleRecord(), null as never)).toThrow();
  });

  it("削除: イベントと実行状態を一緒に消す。無い id だけなら同じレコードを返す", () => {
    const base = applyMarkEvents(applySaveEvent(applySaveEvent(emptyScheduleRecord(), event("a")), event("b")), ["a"], "completed", NOW);
    const r = applyDeleteEvents(base, ["a"]);
    expect(r.events.map((e) => e.id)).toEqual(["b"]);
    expect(r.status).toEqual({});
    expect(applyDeleteEvents(r, ["zzz"])).toBe(r);
  });

  it("取込: 追加・更新と削除を1回で。残るイベントの状態は残す", () => {
    let r = [event("keep"), event("edit"), event("gone")].reduce(applySaveEvent, emptyScheduleRecord());
    r = applyMarkEvents(r, ["gone"], "completed", NOW);
    r = applyMarkEvents(r, ["keep"], "running", NOW);
    const next = applyImportEvents(r, [event("edit", { fadeOutSec: 3 }), event("new")], ["gone"]);
    expect(next.events.map((e) => e.id).sort()).toEqual(["edit", "keep", "new"]);
    expect(next.events.find((e) => e.id === "edit")).toMatchObject({ fadeOutSec: 3 });
    expect(next.status).toEqual({ keep: "running" });
    expect(applyImportEvents(next, [], [])).toBe(next);
  });

  it("状態遷移: 実行中で処理済み日時、完了で登録日時を刻む。同じ状態・消えたイベントは変えない", () => {
    const base = applySaveEvent(emptyScheduleRecord(), event("a"));
    const running = applyMarkEvents(base, ["a", "ghost"], "running", NOW);
    expect(running.status).toEqual({ a: "running" });
    expect(running.events[0]).toMatchObject({ processedAt: NOW, updatedAt: NOW });
    expect(applyMarkEvents(running, ["a", "ghost"], "running", "2030-01-01T00:00:00.000Z")).toBe(running);
    const done = applyMarkEvents(running, ["a"], "completed", NOW);
    expect(done.events[0]).toMatchObject({ registeredAt: NOW });
    expect(applyMarkEvents(done, ["a"], "pending", NOW).status).toEqual({});
    expect(() => applyMarkEvents(done, ["a"], "bogus" as never, NOW)).toThrow();
  });

  it("状態遷移と編集は、どちらの順でも互いを失わない", () => {
    const base = applySaveEvent(emptyScheduleRecord(), event("a"));
    const edit = (r: typeof base) => applySaveEvent(r, event("a", { audioId: "edited" }));
    const mark = (r: typeof base) => applyMarkEvents(r, ["a"], "running", NOW);
    for (const r of [mark(edit(base)), edit(mark(base))]) {
      expect(r.status).toEqual({ a: "running" });
      expect(r.events[0]).toMatchObject({ audioId: "edited", processedAt: NOW });
    }
  });
});

/** 取得してから別の操作を挟めるロック(同じキーを直列化する)。 */
class SerialLock implements ILock {
  private tail: Promise<unknown> = Promise.resolve();
  async withLock<T>(_key: string, _timeoutMs: number, fn: () => Promise<T> | T): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => undefined);
    return run;
  }
}

describe("予定イベントの保存(ロックの中で最新に適用)", () => {
  const deps = () => ({ storage: new InMemoryKeyValueStorage(), lock: new SerialLock(), now: () => new Date(NOW) });

  it("まだ無ければ空を返し、何も書かない", async () => {
    const d = deps();
    expect(await getScheduleEvents(d)).toEqual(emptyScheduleRecord());
    expect(await d.storage.listByPrefix("")).toEqual([]);
  });

  it("保存した内容を、別の呼び出しが読める。変えない操作は書かない", async () => {
    const d = deps();
    await saveScheduleEvent(d, { event: event("a") });
    const [item] = await d.storage.listByPrefix("");
    const before = await d.storage.getContentAsText(item.key);
    await markScheduleEvents(d, { ids: ["a"], status: "running" });
    const afterMark = await d.storage.getContentAsText(item.key);
    expect(afterMark).not.toBe(before);
    await markScheduleEvents(d, { ids: ["a"], status: "running" });
    await deleteScheduleEvents(d, { ids: ["nope"] });
    expect(await d.storage.getContentAsText(item.key)).toBe(afterMark);
    expect((await getScheduleEvents(d)).status).toEqual({ a: "running" });
  });

  it("同時に来た編集と状態遷移の両方が残る", async () => {
    const d = deps();
    await saveScheduleEvent(d, { event: event("a") });
    await Promise.all([
      markScheduleEvents(d, { ids: ["a"], status: "running" }),
      saveScheduleEvent(d, { event: event("a", { audioId: "edited" }) }),
      saveScheduleEvent(d, { event: event("b") }),
    ]);
    const r = await getScheduleEvents(d);
    expect(r.status).toEqual({ a: "running" });
    expect(r.events.find((e) => e.id === "a")).toMatchObject({ audioId: "edited", processedAt: NOW });
    expect(r.events.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("取込で置き換えると、消えたイベントの状態も消える", async () => {
    const d = deps();
    await importScheduleEvents(d, { upserts: [event("a"), event("b")], deleteIds: [] });
    await markScheduleEvents(d, { ids: ["a", "b"], status: "completed" });
    const r = await importScheduleEvents(d, { upserts: [], deleteIds: ["a"] });
    expect(r.events.map((e) => e.id)).toEqual(["b"]);
    expect(r.status).toEqual({ b: "completed" });
  });
});
