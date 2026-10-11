import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { ConnectionState, SessionConnection } from "@octopus/session-hub";
import { tick } from "@octopus/session-hub/testing";
import { MAX_AUTO_REJOINS, MIN_RETRY_INTERVAL_MS, STABLE_CONNECTION_MS, usePortalSession } from "../use-portal-session";
import type { PortalSession, PortalSessionOptions } from "../use-portal-session";
import { ALICE, BOB, MemoryDeviceStore, participantDevice, portalEnv, sampleEvent } from "../../__tests__/portal-test-kit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

/** コンポーネントのスコープの中で composable を動かす(破棄で購読が解放されることも確認できる)。 */
function runInScope(connection: SessionConnection, options: PortalSessionOptions = {}) {
  let session!: PortalSession;
  const app = createApp(
    defineComponent({
      setup() {
        session = usePortalSession(connection, options);
        return () => h("div");
      },
    })
  );
  const root = document.createElement("div");
  app.mount(root);
  return { session, unmount: () => app.unmount() };
}

describe("usePortalSession(実際の接続)", () => {
  it("公開中のセッションに、ログイン中のメンバーとして入って接続中になる", async () => {
    const { hub, meta } = await portalEnv();
    const alice = participantDevice(hub, ALICE);
    const { session, unmount } = runInScope(alice.conn);
    await session.join();
    expect(session.status.value).toBe("connected");
    expect(session.state.value.session?.id).toBe(meta.id);
    expect(session.failure.value).toBeNull();
    unmount();
  });

  it("ホストがイベントを公開すると event に反映され、取り下げると消える", async () => {
    const { hub, publishEvent } = await portalEnv();
    const alice = participantDevice(hub, ALICE);
    const { session, unmount } = runInScope(alice.conn);
    await session.join();
    expect(session.event.value).toBeNull();

    await publishEvent(sampleEvent());
    await tick(5000);
    expect(session.event.value).toEqual(sampleEvent());

    await publishEvent(null);
    await tick(5000);
    expect(session.event.value).toBeNull();
    unmount();
  });

  it("公開中のセッションが無ければ waiting。公開されてから入り直すと接続できる", async () => {
    const { hub, admin, meta } = await portalEnv({ publish: false });
    const alice = participantDevice(hub, ALICE);
    const { session, unmount } = runInScope(alice.conn);
    await session.join();
    expect(session.status.value).toBe("waiting");
    expect(session.message.value).toContain("参加できるイベントはありません");

    await admin.setPortalSession(meta.id, true);
    await session.join();
    expect(session.status.value).toBe("connected");
    expect(session.failure.value).toBeNull();
    unmount();
  });

  it("ログインが無効(メンバー不明)なら error で、ログインし直す案内を出す", async () => {
    const { hub } = await portalEnv();
    const anon = participantDevice(hub, { id: "", name: "" });
    const { session, unmount } = runInScope(anon.conn);
    await session.join();
    expect(session.status.value).toBe("error");
    expect(session.message.value).toContain("ログイン");
    unmount();
  });

  it("入室の呼び出しが重なっても1回だけ実行する(連打対策)", async () => {
    const { hub } = await portalEnv();
    const alice = participantDevice(hub, ALICE);
    const { session, unmount } = runInScope(alice.conn);
    await Promise.all([session.join(), session.join(), session.join()]);
    expect(alice.api.calls.joinPortal).toBe(1);
    unmount();
  });

  it("リロードしても同じ端末として復帰し、別の人が同じ端末でログインすると別の端末になる", async () => {
    const { hub } = await portalEnv();
    const store = new MemoryDeviceStore();
    const first = runInScope(participantDevice(hub, ALICE, { store }).conn);
    await first.session.join();
    const firstDevice = first.session.state.value.deviceId;
    first.unmount();

    const reloaded = runInScope(participantDevice(hub, ALICE, { store }).conn);
    await reloaded.session.join();
    expect(reloaded.session.state.value.deviceId).toBe(firstDevice);
    reloaded.unmount();

    const other = runInScope(participantDevice(hub, BOB, { store }).conn);
    await other.session.join();
    expect(other.session.state.value.deviceId).not.toBe(firstDevice);
    other.unmount();
  });

  it("leave() で保存した入室情報が消え、次は新しい端末になる", async () => {
    const { hub } = await portalEnv();
    const store = new MemoryDeviceStore();
    const first = runInScope(participantDevice(hub, ALICE, { store }).conn);
    await first.session.join();
    const firstDevice = first.session.state.value.deviceId;
    first.session.leave();
    first.unmount();

    const next = runInScope(participantDevice(hub, ALICE, { store }).conn);
    await next.session.join();
    expect(next.session.state.value.deviceId).not.toBe(firstDevice);
    next.unmount();
  });

  it("参加していたセッションが終了したら ended を経て、自動で入り直す(公開中が無ければ waiting)", async () => {
    const { hub, admin, meta } = await portalEnv();
    const alice = participantDevice(hub, ALICE);
    const { session, unmount } = runInScope(alice.conn);
    await session.join();

    await admin.close(meta.id);
    await tick(10_000);
    expect(session.status.value).toBe("waiting");
    expect(alice.api.calls.joinPortal).toBe(2);
    unmount();
  });
});

/** 状態を自由に動かせる偽の接続。自動再接続の回数上限を確かめるために使う。 */
class FakeConnection {
  state: ConnectionState = {
    phase: "idle",
    role: null,
    session: null,
    deviceId: null,
    code: null,
    roomState: null,
    presence: null,
    headSeq: 0,
    round: null,
    recentCommands: [],
    failureCount: 0,
    lastError: null,
    lastErrorCode: null,
    serverOffsetMs: 0,
    skippedCommands: 0,
  };
  joins = 0;
  private listeners = new Set<(s: ConnectionState) => void>();
  /** 入室が成功してから1秒後に流す、次の状態(サーバーからの通知を模す)。 */
  afterJoin: Array<ConnectionState["phase"]> = [];
  failWith: Error | null = null;

  subscribe(listener: (s: ConnectionState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(phase: ConnectionState["phase"]) {
    this.state = { ...this.state, phase };
    for (const l of [...this.listeners]) l(this.state);
  }
  async joinPortal() {
    this.joins++;
    if (this.failWith) throw this.failWith;
    this.set("connected");
    if (this.afterJoin.length > 0) {
      setTimeout(() => {
        for (const phase of this.afterJoin) this.set(phase);
      }, 1000);
    }
    return {} as never;
  }
  setVisible() {}
  dispose() {}
  leave() {}
}

const asConnection = (c: FakeConnection) => c as unknown as SessionConnection;
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("usePortalSession(再接続の暴走防止)", () => {
  it(`入室してもすぐ終了する状態が続いても、自動で入り直すのは最大 ${MAX_AUTO_REJOINS} 回まで(その後は止まる)`, async () => {
    const conn = new FakeConnection();
    // 入室できても1秒後にまた終了する、を永遠に繰り返す状況(サーバー側の不具合を想定)
    conn.afterJoin = ["ended"];
    const { session, unmount } = runInScope(asConnection(conn));
    await session.join();
    await tick(60_000);
    // 手動の入室1回 + 自動の入り直し(上限まで)
    expect(conn.joins).toBe(1 + MAX_AUTO_REJOINS);
    await tick(10 * 60_000);
    expect(conn.joins).toBe(1 + MAX_AUTO_REJOINS);
    expect(session.status.value).toBe("ended");
    unmount();
  });

  it("上限に達したあとも、手動の「つなぎ直す」で入り直せる", async () => {
    const conn = new FakeConnection();
    conn.afterJoin = ["ended"];
    const { session, unmount } = runInScope(asConnection(conn));
    await session.join();
    await tick(60_000);
    const stopped = conn.joins;
    conn.afterJoin = [];
    await session.join();
    expect(conn.joins).toBe(stopped + 1);
    expect(session.status.value).toBe("connected");
    unmount();
  });

  it(`${STABLE_CONNECTION_MS / 1000}秒以上つながったあとの終了なら、回数を数え直して何度でも入り直す`, async () => {
    const conn = new FakeConnection();
    const { session, unmount } = runInScope(asConnection(conn));
    await session.join();
    for (let round = 0; round < MAX_AUTO_REJOINS + 2; round++) {
      await tick(STABLE_CONNECTION_MS + 1000);
      const before = conn.joins;
      conn.set("ended");
      await flush();
      expect(conn.joins, `round ${round}`).toBe(before + 1);
    }
    unmount();
  });

  it("手動の「つなぎ直す」は回数制限なしで、失敗時は error を出す", async () => {
    const conn = new FakeConnection();
    conn.failWith = new Error("network down");
    const { session, unmount } = runInScope(asConnection(conn));
    for (let i = 0; i < 10; i++) await session.join();
    expect(conn.joins).toBe(10);
    expect(session.status.value).toBe("error");
    expect(session.message.value).toContain("通信できませんでした");
    unmount();
  });
});

describe("usePortalSession(画面に戻ったときの再試行)", () => {
  function visibilitySource() {
    let visible = true;
    const listeners = new Set<() => void>();
    return {
      isVisible: () => visible,
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      set(next: boolean) {
        visible = next;
        for (const l of [...listeners]) l();
      },
    };
  }

  it("つながっていないときだけ、前回の試行から一定時間あけて入り直す", async () => {
    const conn = new FakeConnection();
    conn.failWith = Object.assign(new Error("[SESSION_NOT_FOUND] none"), {});
    let nowMs = 1_000_000;
    const visibility = visibilitySource();
    const { session, unmount } = runInScope(asConnection(conn), { now: () => nowMs, visibility });
    await session.join();
    expect(session.status.value).toBe("waiting");
    expect(conn.joins).toBe(1);

    // 直後に画面へ戻っても、間隔が短いので試行しない
    visibility.set(false);
    visibility.set(true);
    await flush();
    expect(conn.joins).toBe(1);

    // 間隔をあければ試行する
    nowMs += MIN_RETRY_INTERVAL_MS + 1;
    visibility.set(false);
    visibility.set(true);
    await flush();
    expect(conn.joins).toBe(2);

    // 画面が隠れたときは試行しない
    nowMs += MIN_RETRY_INTERVAL_MS + 1;
    visibility.set(false);
    await flush();
    expect(conn.joins).toBe(2);
    unmount();
  });

  it("接続中は画面に戻っても入り直さない", async () => {
    const conn = new FakeConnection();
    let nowMs = 1_000_000;
    const visibility = visibilitySource();
    const { session, unmount } = runInScope(asConnection(conn), { now: () => nowMs, visibility });
    await session.join();
    expect(session.status.value).toBe("connected");
    nowMs += 10 * MIN_RETRY_INTERVAL_MS;
    visibility.set(false);
    visibility.set(true);
    await flush();
    expect(conn.joins).toBe(1);
    unmount();
  });

  it("破棄すると画面の表示切り替えを購読しなくなる", async () => {
    const conn = new FakeConnection();
    conn.failWith = new Error("[SESSION_NOT_FOUND] none");
    let nowMs = 1_000_000;
    const visibility = visibilitySource();
    const { session, unmount } = runInScope(asConnection(conn), { now: () => nowMs, visibility });
    await session.join();
    unmount();
    nowMs += 10 * MIN_RETRY_INTERVAL_MS;
    visibility.set(false);
    visibility.set(true);
    await flush();
    expect(conn.joins).toBe(1);
  });
});
