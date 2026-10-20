import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { gamePathRedirectRoutes, toExecutePath } from "./execute-path";

const Empty = { render: () => null };

/** 実行画面(/execute)の中にゲームの画面が登録されている、本物と同じ形のルート表。 */
function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      ...gamePathRedirectRoutes,
      { path: "/home", component: Empty },
      { path: "/show-html/:id", redirect: (to) => ({ name: "show-html", params: { id: to.params.id } }) },
      {
        path: "/execute",
        component: Empty,
        children: [
          { path: "jackpot-admin", component: Empty },
          { path: "jackpot-admin/members", component: Empty },
          { path: "jackpot-draw", component: Empty },
          { path: "quiz-admin", component: Empty },
          { path: "quiz/:id/play", name: "quiz-play", component: Empty },
          { path: "show-html/:id", name: "show-html", component: Empty },
        ],
      },
    ],
  });
}

describe("toExecutePath", () => {
  it.each([
    ["/jackpot-admin", "/execute/jackpot-admin"],
    ["/jackpot-admin/members", "/execute/jackpot-admin/members"],
    ["/quiz-admin", "/execute/quiz-admin"],
    ["/quiz/q1/play", "/execute/quiz/q1/play"],
  ])("ゲームの画面 %s には /execute を付ける", (path, expected) => {
    expect(toExecutePath(path)).toBe(expected);
  });

  it.each(["/home", "/execute/jackpot-admin", "/sessions", "/quizzes", "/jackpotx", "/", "/show-html/a"])(
    "それ以外(%s)や、すでに /execute 付きのパスはそのまま",
    (path) => {
      expect(toExecutePath(path)).toBe(path);
    }
  );
});

describe("ゲームの画面へのルート", () => {
  it("どこから来ても、ゲームのパスは /execute の中へ振り替わる（/jackpot- も /quiz- も /quiz/ も）", async () => {
    for (const [path, expected] of [
      ["/jackpot-admin", "/execute/jackpot-admin"],
      ["/jackpot-admin/members", "/execute/jackpot-admin/members"],
      ["/quiz-admin", "/execute/quiz-admin"],
      ["/quiz/q1/play", "/execute/quiz/q1/play"],
    ]) {
      const router = makeRouter();
      await router.push("/home"); // 実行画面の外から
      await router.push(path);
      expect(router.currentRoute.value.fullPath).toBe(expected);
    }
  });

  it("実行画面の中からでも同じ結果になる（遷移元で結果が変わらない）", async () => {
    const router = makeRouter();
    await router.push("/execute/jackpot-draw");
    await router.push("/quiz/q1/play");
    expect(router.currentRoute.value.fullPath).toBe("/execute/quiz/q1/play");
  });

  it("クエリ（デモの印など）は引き継がれる", async () => {
    const router = makeRouter();
    await router.push("/jackpot-draw?demo=1");
    expect(router.currentRoute.value.fullPath).toBe("/execute/jackpot-draw?demo=1");
  });

  it("すでに /execute 付きのパスは、そのまま開く（二重に付かない）", async () => {
    const router = makeRouter();
    await router.push("/execute/jackpot-admin");
    expect(router.currentRoute.value.fullPath).toBe("/execute/jackpot-admin");
  });
});

describe("HTML 表示のリンク（/show-html/:id）", () => {
  it("id から、実行画面の中の表示画面へ振り替わる（以前は必須の id が無く、開けなかった）", async () => {
    const router = makeRouter();
    await router.push("/show-html/abc");
    expect(router.currentRoute.value.name).toBe("show-html");
    expect(router.currentRoute.value.params.id).toBe("abc");
    expect(router.currentRoute.value.fullPath).toBe("/execute/show-html/abc");
  });
});
