import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import type { Command, SessionConnection } from "@octopus/session-hub";
import { tick } from "@octopus/session-hub/testing";
import { ALICE, BOB, MemoryDeviceStore, participantDevice, portalEnv, sampleEvent, sampleQuizState } from "../../__tests__/portal-test-kit";
import type { Device } from "../../__tests__/portal-test-kit";
import { PARTICIPANT_AUTH_KEY } from "../../model/participant-auth";
import { participantPortalRoutes } from "../../routes";

// レイアウトは自分で接続を作る。テストでは用意した接続に差し替える。
let nextConnection: SessionConnection | null = null;
vi.mock("@octopus/session-hub", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/session-hub")>();
  return { ...actual, createSessionConnection: () => nextConnection! };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  // エントリー済みの保存（localStorage）が、同じIDを使うテストへ持ち越されないようにする
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

const Stub = defineComponent({ render: () => h("div", "stub") });

interface Mounted {
  wrapper: VueWrapper;
  router: ReturnType<typeof createRouter>;
  device: Device;
  signOut: ReturnType<typeof vi.fn>;
}

async function mountPortal(device: Device, path = "/p", member: { id: string; name: string } = ALICE): Promise<Mounted> {
  nextConnection = device.conn;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [...participantPortalRoutes, { path: "/login", component: Stub }],
  });
  const signOut = vi.fn(async () => undefined);
  await router.push(path);
  await router.isReady();
  const wrapper = mount(
    defineComponent({ render: () => h(RouterView) }),
    {
      global: {
        plugins: [router],
        provide: { [PARTICIPANT_AUTH_KEY as symbol]: { currentMember: ref(member), signOut } },
      },
      attachTo: document.body,
    }
  );
  await flushPromises();
  await tick(0);
  return { wrapper, router, device, signOut };
}

const text = (m: Mounted, testId: string) => m.wrapper.find(`[data-testid="${testId}"]`).text();
const has = (m: Mounted, testId: string) => m.wrapper.find(`[data-testid="${testId}"]`).exists();

describe("参加者ポータル: 接続とホーム", () => {
  it("公開中のセッションに入り、あいさつと会場の参加者数を表示する(イベントが無いときの案内つき)", async () => {
    const { hub } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(text(m, "home-greeting")).toContain("アリス さん、ようこそ");
    expect(text(m, "portal-conn")).toContain("接続中");
    expect(text(m, "home-status")).toContain("いまイベントは行われていません");
    expect(has(m, "event-banner")).toBe(false);
    expect(has(m, "home-join")).toBe(false);
    m.wrapper.unmount();
  });

  it("公開中のセッションが無いと待機の案内とつなぎ直すボタンを出し、公開後に押すと接続できる", async () => {
    const { hub, admin, meta } = await portalEnv({ publish: false });
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(text(m, "portal-conn")).toContain("イベント待ち");
    expect(text(m, "home-status")).toContain("参加できるイベントはありません");

    await admin.setPortalSession(meta.id, true);
    await m.wrapper.find('[data-testid="home-retry"]').trigger("click");
    await flushPromises();
    await tick(0);
    expect(text(m, "portal-conn")).toContain("接続中");
    expect(has(m, "home-retry")).toBe(false);
    m.wrapper.unmount();
  });

  it("下のタブで現在地が分かり、イベント・結果・マイページへ移動できる", async () => {
    const { hub } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    const tabs = () => m.wrapper.findAll(".pp-tabs__item");
    expect(tabs().map((t) => t.text())).toEqual(["ホーム", "イベント", "結果", "マイページ"]);
    expect(tabs()[0].classes()).toContain("is-active");
    expect(tabs()[1].classes()).not.toContain("is-active");
    expect(tabs()[2].classes()).not.toContain("is-active");

    await tabs()[1].trigger("click");
    await flushPromises();
    expect(m.router.currentRoute.value.fullPath).toBe("/p/event");
    expect(tabs()[0].classes()).not.toContain("is-active");
    expect(tabs()[1].classes()).toContain("is-active");

    await tabs()[2].trigger("click");
    await flushPromises();
    expect(m.router.currentRoute.value.fullPath).toBe("/p/results");
    expect(tabs()[1].classes()).not.toContain("is-active");
    expect(tabs()[2].classes()).toContain("is-active");

    await tabs()[3].trigger("click");
    await flushPromises();
    expect(m.router.currentRoute.value.fullPath).toBe("/p/me");
    expect(tabs()[3].classes()).toContain("is-active");
    m.wrapper.unmount();
  });
});

describe("参加者ポータル: イベント発生中のお知らせ", () => {
  it("ホストがイベントを公開すると、画面上部のバナーとホームの「参加する」に出る", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(has(m, "event-banner")).toBe(false);

    await publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-banner")).toContain("イベント発生中!");
    expect(text(m, "event-banner")).toContain("ジャックポット抽選");
    expect(text(m, "home-event-title")).toBe("ジャックポット抽選");
    expect(has(m, "home-join")).toBe(true);
    m.wrapper.unmount();
  });

  it("バナーを押すとイベント画面へ。イベント画面ではバナーを重ねて出さない", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    await publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();

    await m.wrapper.find('[data-testid="event-banner"]').trigger("click");
    await flushPromises();
    expect(m.router.currentRoute.value.name).toBe("participant-event");
    expect(text(m, "event-title")).toBe("ジャックポット抽選");
    expect(has(m, "event-banner")).toBe(false);
    m.wrapper.unmount();
  });

  it("イベントが取り下げられると、バナーが消え、イベント画面は「行われていません」の案内に変わる", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE), "/p/event");
    await publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-title")).toBe("ジャックポット抽選");

    await publishEvent(null);
    await tick(5000);
    await flushPromises();
    expect(has(m, "event-title")).toBe(false);
    expect(text(m, "event-none")).toContain("いまイベントは行われていません");
    expect(has(m, "event-banner")).toBe(false);
    m.wrapper.unmount();
  });

  it("イベントが新しいものに切り替わると、タイトルが更新される", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    await publishEvent(sampleEvent());
    await tick(5000);
    await publishEvent(sampleEvent({ id: "event-2", title: "乾杯クイズ" }));
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-banner")).toContain("乾杯クイズ");
    m.wrapper.unmount();
  });

  it("接続できていない間は、古いイベントのバナーを出さない", async () => {
    const { hub } = await portalEnv({ publish: false });
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(has(m, "event-banner")).toBe(false);
    m.wrapper.unmount();
  });
});

describe("参加者ポータル: マイページ", () => {
  it("名前とIDを表示する", async () => {
    const { hub } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE), "/p/me");
    expect(text(m, "me-name")).toBe("アリス");
    expect(text(m, "me-id")).toBe("ID: alice");
    m.wrapper.unmount();
  });

  it("ログアウトすると、入室情報を消してログアウトし、ログイン画面へ戻る", async () => {
    const { hub } = await portalEnv();
    const store = new MemoryDeviceStore();
    const m = await mountPortal(participantDevice(hub, ALICE, { store }), "/p/me");
    const before = m.device.conn.state.deviceId;
    expect(before).toBeTruthy();

    await m.wrapper.find('[data-testid="me-signout"]').trigger("click");
    await flushPromises();
    expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(m.router.currentRoute.value.fullPath).toBe("/login");
    expect(m.device.conn.state.phase).toBe("idle");

    // 同じ端末で次に入ると、前の端末情報は引き継がれず新しい端末になる
    const next = participantDevice(hub, ALICE, { store });
    await next.conn.joinPortal();
    expect(next.conn.state.deviceId).not.toBe(before);
    next.conn.dispose();
    m.wrapper.unmount();
  });
});

describe("参加者ポータル: エントリー", () => {
  it("受付が始まる前は案内だけ。始まるとバナー・ホーム・イベント画面でエントリーを促す", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    await env.publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(has(m, "entry-none")).toBe(true);
    expect(has(m, "entry-button")).toBe(false);

    await env.openEntry(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(has(m, "entry-open")).toBe(true);
    expect(text(m, "entry-button")).toContain("エントリー");

    await m.router.push("/p");
    await flushPromises();
    expect(text(m, "event-banner")).toContain("エントリー受付中!");
    expect(text(m, "home-entry-open")).toContain("エントリー受付中!");
    expect(text(m, "home-join")).toBe("エントリーする");
    m.wrapper.unmount();
  });

  it("エントリーするボタンを押すと「エントリーしました!」になり、バナーとホームは済みの表示に変わる", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    const event = await env.openEntry(sampleEvent());
    await tick(5000);
    await flushPromises();

    await m.wrapper.find('[data-testid="entry-button"]').trigger("click");
    await flushPromises();
    await tick(0);
    expect(text(m, "entry-done")).toContain("エントリーしました!");
    expect(has(m, "entry-button")).toBe(false);
    expect(await env.entrants(event.entry!.key)).toEqual(["alice"]);

    await m.router.push("/p");
    await flushPromises();
    expect(text(m, "event-banner")).toContain("イベント発生中!");
    expect(text(m, "home-entry-done")).toContain("エントリー済み");
    expect(text(m, "home-join")).toBe("参加する");
    m.wrapper.unmount();
  });

  it("締め切ると、未エントリーの人には終了の案内、エントリー済みの人には受付終了と結果待ちの案内", async () => {
    const env = await portalEnv();
    const alice = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    const event = await env.openEntry(sampleEvent());
    await tick(5000);
    await flushPromises();
    await alice.wrapper.find('[data-testid="entry-button"]').trigger("click");
    await flushPromises();

    await env.closeEntry(event);
    await tick(5000);
    await flushPromises();
    expect(text(alice, "entry-done")).toContain("受付は終了しました");
    expect(has(alice, "entry-button")).toBe(false);
    alice.wrapper.unmount();

    // 未エントリーのボブ（同じ端末の別の人ではなく、別のスマホ）には、終了の案内だけが出る
    const bob = await mountPortal(participantDevice(env.hub, BOB), "/p/event", BOB);
    expect(has(bob, "entry-button")).toBe(false);
    expect(has(bob, "entry-done")).toBe(false);
    expect(text(bob, "entry-closed")).toContain("エントリーの受付は終了しました");
    bob.wrapper.unmount();
  });

  it("受付を再開すると、締切後に来た人もエントリーできる", async () => {
    const env = await portalEnv();
    const event = await env.openEntry(sampleEvent());
    const closed = await env.closeEntry(event);
    const late = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    expect(has(late, "entry-closed")).toBe(true);

    await env.openEntry(closed, true);
    await tick(5000);
    await flushPromises();
    expect(has(late, "entry-open")).toBe(true);
    await late.wrapper.find('[data-testid="entry-button"]').trigger("click");
    await flushPromises();
    expect(text(late, "entry-done")).toContain("エントリーしました!");
    expect(await env.entrants(event.entry!.key)).toEqual(["alice"]);
    late.wrapper.unmount();
  });

  it("イベントが終わると、エントリーの表示は出さず終了の案内になる", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    await env.openEntry(sampleEvent());
    await tick(5000);
    await env.publishEvent(null);
    await tick(5000);
    await flushPromises();
    expect(has(m, "entry-open")).toBe(false);
    expect(text(m, "event-none")).toContain("いまイベントは行われていません");
    m.wrapper.unmount();
  });
});

describe("参加者ポータル: クイズ", () => {
  it("出題されるとイベントタブに問題と選択肢・残り時間が出て、押すと「回答しました」になる", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    await env.startQuiz();
    await tick(5000);
    await flushPromises();
    expect(text(m, "quiz-panel")).toContain("みかんはどれ?");
    expect(text(m, "quiz-timer")).toMatch(/残り \d+ 秒/);
    const buttons = m.wrapper.findAll(".pp-quiz__option");
    expect(buttons.map((b) => b.text())).toEqual(["1りんご", "2みかん", "3ぶどう"]);

    await buttons[1].trigger("click");
    await flushPromises();
    await tick(0);
    expect(text(m, "quiz-answered")).toContain("2. みかん");
    // 受付中は、回答後も選び直せる(選んだものが強調され、案内が出る)
    expect(has(m, "quiz-changeable")).toBe(true);
    expect(m.wrapper.findAll(".pp-quiz__option").every((b) => b.attributes("disabled") === undefined)).toBe(true);
    expect(m.wrapper.findAll(".pp-quiz__option")[1].classes()).toContain("is-chosen");

    await m.wrapper.findAll(".pp-quiz__option")[2].trigger("click");
    await flushPromises();
    await tick(0);
    expect(text(m, "quiz-answered")).toContain("3. ぶどう");
    expect(m.wrapper.findAll(".pp-quiz__option")[2].classes()).toContain("is-chosen");
    expect(m.wrapper.findAll(".pp-quiz__option")[1].classes()).not.toContain("is-chosen");
    m.wrapper.unmount();
  });

  it("締め切られると、回答済みでも選び直せなくなり、選び直しの案内も消える", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    const quiz = await env.startQuiz();
    await tick(5000);
    await flushPromises();
    await m.wrapper.findAll(".pp-quiz__option")[0].trigger("click");
    await flushPromises();
    await tick(0);
    expect(has(m, "quiz-changeable")).toBe(true);

    await env.host.conn.closeRound(quiz.roundKey!);
    await env.publishQuiz({ ...quiz, phase: "closed", deadlineMs: null });
    await tick(5000);
    await flushPromises();
    expect(has(m, "quiz-changeable")).toBe(false);
    expect(text(m, "quiz-answered")).toContain("1. りんご");
    expect(m.wrapper.findAll(".pp-quiz__option").every((b) => b.attributes("disabled") !== undefined)).toBe(true);
    m.wrapper.unmount();
  });

  it("回答受付中でまだ答えていない人には「クイズ出題中!」をバナーで出し、答えるとバナーは消える（イベントタブでは重ねて出さない）", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/me");
    await env.publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-banner")).toContain("イベント発生中!");

    await env.startQuiz();
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-banner")).toContain("クイズ出題中!");
    expect(text(m, "event-banner")).toContain("果物クイズ");

    // バナーからイベントタブへ。イベントタブでは同じ内容のバナーは出さない（イベントのバナーに戻ることもない）
    await m.wrapper.find('[data-testid="event-banner"]').trigger("click");
    await flushPromises();
    expect(m.router.currentRoute.value.fullPath).toBe("/p/event");
    expect(has(m, "event-banner")).toBe(false);

    await m.wrapper.findAll(".pp-quiz__option")[0].trigger("click");
    await flushPromises();
    await tick(0);
    expect(has(m, "quiz-answered")).toBe(true);
    // イベントタブを開いている間は、イベントのバナーも出さない。ほかの画面に移ると出る
    expect(has(m, "event-banner")).toBe(false);
    await m.router.push("/p/me");
    await flushPromises();
    expect(text(m, "event-banner")).toContain("イベント発生中!");
    m.wrapper.unmount();
  });

  describe("出題時の自動遷移", () => {
    async function enteredAt(path: string) {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      await env.openEntry(sampleEvent());
      await tick(5000);
      await flushPromises();
      await m.wrapper.find('[data-testid="entry-button"]').trigger("click");
      await flushPromises();
      await tick(0);
      if (path !== "/p/event") await m.router.push(path);
      await flushPromises();
      return { env, m };
    }

    it.each(["/p", "/p/event", "/p/results", "/p/me"])("エントリー済みの人は、%s にいても出題と同時に回答画面(/p/event)へ移る", async (path) => {
      const { env, m } = await enteredAt(path);
      await env.startQuiz();
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe("/p/event");
      expect(has(m, "quiz-panel")).toBe(true);
      m.wrapper.unmount();
    });

    it("エントリーしていない人は、ホームにいるときだけ移る", async () => {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), "/p");
      await env.publishEvent(sampleEvent());
      await tick(5000);
      await flushPromises();
      await env.startQuiz();
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe("/p/event");
      m.wrapper.unmount();
    });

    it.each(["/p/results", "/p/me"])("エントリーしていない人が %s を見ていても移動させず、バナーで知らせる", async (path) => {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), path);
      await env.startQuiz();
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe(path);
      expect(text(m, "event-banner")).toContain("クイズ出題中!");
      m.wrapper.unmount();
    });

    it("同じ出題では1回だけ移り、戻っても連れ戻さない。次の出題ではまた移る", async () => {
      const { env, m } = await enteredAt("/p/me");
      await env.startQuiz();
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe("/p/event");

      await m.router.push("/p/results");
      await flushPromises();
      await env.publishQuiz({ ...sampleQuizState() });
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe("/p/results");

      await env.startQuiz({ roundKey: "qz1:next" });
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe("/p/event");
      m.wrapper.unmount();
    });

    it("回答済み・受付中でない出題では移動しない", async () => {
      const { env, m } = await enteredAt("/p/me");
      await env.publishQuiz({ ...sampleQuizState(), page: "intro", phase: "idle", roundKey: null, question: null, options: [] });
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe("/p/me");
      await env.publishQuiz({ ...sampleQuizState(), phase: "closed", deadlineMs: null });
      await tick(5000);
      await flushPromises();
      expect(m.router.currentRoute.value.fullPath).toBe("/p/me");
      m.wrapper.unmount();
    });
  });

  it("クイズ・当選者・操作が出ている間は「イベントは行われていません」を出さず、それらを出す。イベントがあれば見出しも出す", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    expect(text(m, "event-none")).toContain("いまイベントは行われていません");

    await env.startQuiz();
    await tick(5000);
    await flushPromises();
    expect(has(m, "quiz-panel")).toBe(true);
    expect(has(m, "event-none")).toBe(false);

    await env.publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-title")).toBe("ジャックポット抽選");
    expect(has(m, "quiz-panel")).toBe(true);
    // クイズの最中は、エントリーの案内を重ねて出さない
    expect(has(m, "entry-none")).toBe(false);

    await env.publishQuiz(null);
    await env.publishJackpot({ stage: "prize-revealed", canStop: false, member: "太郎", prize: "特賞" });
    await env.publishEvent(null);
    await tick(5000);
    await flushPromises();
    expect(has(m, "winner")).toBe(true);
    expect(has(m, "event-none")).toBe(false);
    m.wrapper.unmount();
  });

  it("ホームには進行中のものを出さず、イベントタブへの入口だけを出す", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE));
    expect(text(m, "home-status")).toContain("いまイベントは行われていません");

    await env.startQuiz();
    await tick(5000);
    await flushPromises();
    // 未エントリーでホームにいる人は、出題と同時にイベントタブへ移る。ホームに戻ると入口だけがある
    await m.router.push("/p");
    await flushPromises();
    expect(has(m, "quiz-panel")).toBe(false);
    expect(text(m, "home-join")).toBe("イベントを見る");
    m.wrapper.unmount();
  });

  it("イベントやクイズが出ている間は「イベント」タブが光り、イベントタブを開いている間・何も無いときは光らない", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/me");
    const eventTab = () => m.wrapper.findAll(".pp-tabs__item")[1];
    expect(eventTab().classes()).not.toContain("is-live");

    await env.publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(eventTab().classes()).toContain("is-live");
    expect(has(m, "event-live")).toBe(true);

    await m.router.push("/p/event");
    await flushPromises();
    expect(eventTab().classes()).not.toContain("is-live");

    await m.router.push("/p/results");
    await env.publishEvent(null);
    await tick(5000);
    await flushPromises();
    expect(eventTab().classes()).not.toContain("is-live");

    await env.startQuiz();
    await tick(5000);
    await flushPromises();
    expect(eventTab().classes()).toContain("is-live");
    m.wrapper.unmount();
  });

  it("受付が終わったクイズでは、バナーを出さない。時間切れの表示と、正解発表の判定が出る", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    const quiz = await env.startQuiz({}, 3_000);
    await tick(5000);
    await flushPromises();
    await tick(4000);
    await flushPromises();
    expect(text(m, "quiz-closed")).toContain("受付は終了しました");
    expect(m.wrapper.findAll(".pp-quiz__option").every((b) => b.attributes("disabled") !== undefined)).toBe(true);
    expect(has(m, "event-banner")).toBe(false);

    await env.publishQuiz({ ...sampleQuizState(), ...quiz, page: "answer", phase: "closed", deadlineMs: null, correctNo: 2 });
    await tick(5000);
    await flushPromises();
    expect(text(m, "quiz-correct")).toContain("2. みかん");
    expect(m.wrapper.text()).toContain("あなたは回答していません");
    m.wrapper.unmount();
  });

  it("イントロ・結果発表の案内を出す", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    await env.publishQuiz({ ...sampleQuizState(), page: "intro", phase: "idle", roundKey: null, question: null, options: [] });
    await tick(5000);
    await flushPromises();
    expect(text(m, "quiz-panel")).toContain("クイズが始まります");

    await env.publishQuiz({ ...sampleQuizState(), page: "result", phase: "idle", question: null, options: [] });
    await tick(5000);
    await flushPromises();
    expect(text(m, "quiz-panel")).toContain("結果発表中です");
    // 結果発表のあとは、そのまま「結果」タブで順位を見られる
    expect(m.wrapper.find('[data-testid="quiz-results-link"]').attributes("href")).toBe("/p/results");
    m.wrapper.unmount();
  });
});

describe("参加者ポータル: ジャックポットと参加者の操作", () => {
  const STOP = { stage: "member" as const, canStop: true, member: null, prize: null };

  it("当選者・賞品は公開されたときだけ出る（停止演出の前は出ない）", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    await env.publishJackpot(STOP);
    await tick(5000);
    await flushPromises();
    expect(has(m, "winner")).toBe(false);

    await env.publishJackpot({ ...STOP, canStop: false, member: "太郎", prize: "特賞" });
    await tick(5000);
    await flushPromises();
    expect(text(m, "winner-member")).toContain("太郎");
    expect(text(m, "winner-prize")).toContain("特賞");
    m.wrapper.unmount();
  });

  describe("待機画面と当選演出", () => {
    const base = { canStop: false, member: null, memberId: null, prize: null };

    it("抽選の段階に合わせた待機画面が出て、「お待ちください」だけにならない", async () => {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      expect(has(m, "jackpot-waiting")).toBe(false);

      await env.publishJackpot({ ...base, stage: "waiting" });
      await tick(5000);
      await flushPromises();
      expect(text(m, "jackpot-waiting-title")).toContain("まもなく抽選");

      await env.publishJackpot({ ...base, stage: "member" });
      await tick(5000);
      await flushPromises();
      expect(text(m, "jackpot-waiting-title")).toContain("メンバー抽選中");

      await env.publishJackpot({ ...base, stage: "prize", member: "太郎", memberId: "taro" });
      await tick(5000);
      await flushPromises();
      expect(text(m, "jackpot-waiting-title")).toContain("景品抽選中");
      expect(text(m, "jackpot-waiting")).toContain("太郎");

      // 景品まで決まったら待機画面は消え、結果が出る
      await env.publishJackpot({ ...base, stage: "prize-revealed", member: "太郎", memberId: "taro", prize: "特賞" });
      await tick(5000);
      await flushPromises();
      expect(has(m, "jackpot-waiting")).toBe(false);
      expect(text(m, "winner-prize")).toContain("特賞");
      m.wrapper.unmount();
    });

    it("当選者・賞品が公開された瞬間に、全員の画面で弾ける演出が出る。公開前は出ず、別の当選者・賞品になるたびに出し直す", async () => {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");

      await env.publishJackpot({ ...base, stage: "member" });
      await tick(5000);
      await flushPromises();
      expect(has(m, "reveal-burst-member")).toBe(false);
      expect(has(m, "reveal-burst-prize")).toBe(false);

      await env.publishJackpot({ ...base, stage: "member-revealed", member: "太郎", memberId: "taro" });
      await tick(5000);
      await flushPromises();
      expect(has(m, "reveal-burst-member")).toBe(true);
      expect(has(m, "reveal-burst-prize")).toBe(false);
      const firstBurst = m.wrapper.find('[data-testid="reveal-burst-member"]').element;

      await env.publishJackpot({ ...base, stage: "prize-revealed", member: "太郎", memberId: "taro", prize: "特賞" });
      await tick(5000);
      await flushPromises();
      expect(has(m, "reveal-burst-prize")).toBe(true);
      // 同じ当選者のままなら、当選者の演出は作り直さない（景品の公開で、もう一度弾けない）
      expect(m.wrapper.find('[data-testid="reveal-burst-member"]').element).toBe(firstBurst);

      // 次の抽選で別の人が当たったら、また出る
      await env.publishJackpot({ ...base, stage: "member-revealed", member: "花子", memberId: "hanako" });
      await tick(5000);
      await flushPromises();
      expect(m.wrapper.find('[data-testid="reveal-burst-member"]').element).not.toBe(firstBurst);
      m.wrapper.unmount();
    });

    it("エントリー済みの人のエントリー画面にも、待機画面と結果が出る", async () => {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      await env.openEntry(sampleEvent());
      await tick(5000);
      await flushPromises();
      await m.wrapper.find('[data-testid="entry-button"]').trigger("click");
      await flushPromises();
      await tick(0);
      expect(has(m, "entry-done")).toBe(true);

      await env.publishJackpot({ ...base, stage: "member" });
      await tick(5000);
      await flushPromises();
      expect(has(m, "entry-done")).toBe(false);
      expect(text(m, "jackpot-waiting-title")).toContain("メンバー抽選中");

      await env.publishJackpot({ ...base, stage: "prize-revealed", member: "太郎", memberId: "taro", prize: "特賞" });
      await tick(5000);
      await flushPromises();
      expect(text(m, "winner-prize")).toContain("特賞");
      m.wrapper.unmount();
    });

    it("自分が当選したときだけ「あなたがあたりました!」が全面に出る。公開前は出ず、閉じられる", async () => {
      const env = await portalEnv();
      const alice = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      const bob = await mountPortal(participantDevice(env.hub, BOB), "/p/event", BOB);

      // 停止演出の前(当選者が未公開)は誰にも出ない
      await env.publishJackpot({ ...base, stage: "member" });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(false);

      await env.publishJackpot({ ...base, stage: "member-revealed", member: ALICE.name, memberId: ALICE.id });
      await tick(5000);
      await flushPromises();
      expect(text(alice, "you-won")).toContain("あたりました");
      expect(text(alice, "you-won-name")).toContain(ALICE.name);
      expect(has(bob, "you-won")).toBe(false);
      expect(text(bob, "winner-member")).toContain(ALICE.name);

      await alice.wrapper.find('[data-testid="you-won-close"]').trigger("click");
      expect(has(alice, "you-won")).toBe(false);

      // 次の抽選で、もう一度当たったら、また出る
      await env.publishJackpot({ ...base, stage: "member" });
      await tick(5000);
      await flushPromises();
      await env.publishJackpot({ ...base, stage: "member-revealed", member: ALICE.name, memberId: ALICE.id });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(true);
      alice.wrapper.unmount();
      bob.wrapper.unmount();
    });

    it("当選の表示は、景品抽選に進んだら自動で閉じる。手で閉じなくてよい(今回の不具合)", async () => {
      const env = await portalEnv();
      const alice = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      const win = { ...base, member: ALICE.name, memberId: ALICE.id };

      await env.publishJackpot({ ...win, stage: "member-revealed" });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(true);

      // 景品抽選の画面に進んだ → 場面が変わるので、閉じるボタンを押さなくても消える
      await env.publishJackpot({ ...win, stage: "prize" });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(false);
      expect(text(alice, "jackpot-waiting-title")).toContain("景品抽選中");

      // 景品が決まっても、終了しても、出し直さない
      await env.publishJackpot({ ...win, stage: "prize-revealed", prize: "特賞" });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(false);
      await env.publishJackpot({ ...win, stage: "ended", prize: "特賞" });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(false);
      alice.wrapper.unmount();
    });

    it("当選の表示を手で閉じたあとに景品抽選へ進んでも壊れない。次の抽選で当たれば、また出る", async () => {
      const env = await portalEnv();
      const alice = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      const win = { ...base, member: ALICE.name, memberId: ALICE.id };

      await env.publishJackpot({ ...win, stage: "member-revealed" });
      await tick(5000);
      await flushPromises();
      await alice.wrapper.find('[data-testid="you-won-close"]').trigger("click");
      expect(has(alice, "you-won")).toBe(false);

      await env.publishJackpot({ ...win, stage: "prize" });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(false);

      await env.publishJackpot({ ...base, stage: "member" });
      await tick(5000);
      await flushPromises();
      await env.publishJackpot({ ...win, stage: "member-revealed" });
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(true);
      alice.wrapper.unmount();
    });

    it("途中でリロードして景品抽選の最中に入り直した当選者には、当選の全面表示は出ない(景品抽選の待機画面と停止ボタンが見える)", async () => {
      const env = await portalEnv();
      await env.publishJackpot(
        { ...base, stage: "prize", canStop: true, member: ALICE.name, memberId: ALICE.id },
        [{ key: "jackpot.stopRoulette", memberIds: [ALICE.id] }]
      );
      const alice = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      await tick(5000);
      await flushPromises();
      expect(has(alice, "you-won")).toBe(false);
      expect(has(alice, "client-inputs")).toBe(true);
      alice.wrapper.unmount();
    });

    it("当選の演出は、ほかの画面(結果タブ)にいても出る", async () => {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/results");
      await env.publishJackpot({ ...base, stage: "member-revealed", member: ALICE.name, memberId: ALICE.id });
      await tick(5000);
      await flushPromises();
      expect(has(m, "you-won")).toBe(true);
      m.wrapper.unmount();
    });

    it("長い賞品名・当選者名でも、そのまま折り返して表示する", async () => {
      const env = await portalEnv();
      const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
      const prize = "とても長い名前の特別賞品セット(ペア宿泊券+お食事券+記念品)";
      await env.publishJackpot({ ...base, stage: "prize-revealed", member: "あ".repeat(40), memberId: "x", prize });
      await tick(5000);
      await flushPromises();
      expect(text(m, "winner-prize")).toContain(prize);
      m.wrapper.unmount();
    });
  });

  it("ホストが許可した操作がボタンで出て、押すとホストへ届く。受付が終わると消える", async () => {
    const env = await portalEnv();
    const seen: Command[] = [];
    env.host.conn.onCommand((c) => void seen.push(c));
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    expect(has(m, "client-inputs")).toBe(false);

    await env.publishJackpot(STOP, [{ key: "jackpot.stopRoulette" }]);
    await tick(5000);
    await flushPromises();
    const button = m.wrapper.find('[data-testid="client-input"]');
    expect(button.text()).toBe("ルーレットを止める");

    await button.trigger("click");
    await flushPromises();
    await tick(5000);
    expect(text(m, "client-input-message")).toBe("送信しました");
    expect(seen.map((c) => `${c.game}.${c.type}`)).toEqual(["jackpot.stopRoulette"]);

    await env.publishJackpot({ ...STOP, canStop: false }, []);
    await tick(5000);
    await flushPromises();
    expect(has(m, "client-inputs")).toBe(false);
    m.wrapper.unmount();
  });

  it("宛先が当選者の停止ボタンは、当選者の画面にだけ出て、他の参加者には出ない(今回の不具合)", async () => {
    const env = await portalEnv();
    const winner = await mountPortal(participantDevice(env.hub, ALICE), "/p/event", ALICE);
    const other = await mountPortal(participantDevice(env.hub, BOB), "/p/event", BOB);

    await env.publishJackpot({ ...STOP, stage: "prize", member: "アリス", memberId: ALICE.id }, [{ key: "jackpot.stopRoulette", memberIds: [ALICE.id] }]);
    await tick(5000);
    await flushPromises();
    expect(winner.wrapper.find('[data-testid="client-input"]').text()).toBe("ルーレットを止める");
    expect(has(other, "client-inputs")).toBe(false);

    winner.wrapper.unmount();
    other.wrapper.unmount();
  });

  it("接続できていない（イベント待ち）間は、クイズ・当選者・操作を出さない", async () => {
    const env = await portalEnv({ publish: false });
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    expect(has(m, "quiz-panel")).toBe(false);
    expect(has(m, "winner")).toBe(false);
    expect(has(m, "client-inputs")).toBe(false);
    m.wrapper.unmount();
  });
});
