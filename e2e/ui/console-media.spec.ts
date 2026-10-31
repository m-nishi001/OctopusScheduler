import { adminRpc, createSession, expect, newDevice, route, test } from "./fixtures";
import type { Browser } from "@playwright/test";
import { expectNoHorizontalOverflow, VIEWPORTS } from "./helpers/responsive";
import { audioProbe, deleteLocalAsset, hasLocalAsset, installAudioProbe, PNG_1X1, seedLocalAsset, seedServerAsset, silentWav, uid } from "./helpers/media";

/**
 * 管理端末の「音楽・スクリーン」から、ホスト(投影)の画面と音楽を動かす。
 * 管理端末とホストの2つの端末で、media の指示(再生・停止・表示・消す)が届くことを確かめる。
 */
const sessionIds: string[] = [];
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
});

async function scene(browser: Browser, request: import("@playwright/test").APIRequestContext, label: string) {
  const tag = uid();
  const image = { id: `e2eimg${tag}`, fileName: `e2e-pic-${tag}.png`, mime: "image/png", body: PNG_1X1 };
  const song = { id: `e2esong${tag}`, fileName: `e2e-tone-${tag}.wav`, mime: "audio/wav", body: silentWav() };
  await seedServerAsset(request, image);
  await seedServerAsset(request, song);

  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);

  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await installAudioProbe(host.context);
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();

  // 管理端末の一覧は、画面を開いたときに取る。素材を入れたあとに読み直す
  await admin.page.getByTestId("media-reload").click();
  await expect(admin.page.getByTestId(`media-play-${song.id}`)).toBeVisible();
  return { admin, host, sessionId, image, song, lobby: `/session/host/${sessionId}` };
}

test.describe("コントロール画面: 音楽・スクリーン", () => {
  test("画像を表示すると、ホストは出したままになり、「消す」でロビーに戻る。スマホ幅でも崩れない", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const { admin, host, image, lobby } = await scene(browser, request, "メディア(画像)");
    await admin.page.getByTestId("media-tab-screen").click();
    await expect(admin.page.getByTestId("media-visual").filter({ hasText: image.fileName })).toBeVisible();

    await admin.page.getByTestId(`media-show-${image.id}`).click();
    await expect.poll(() => route(host.page)).toBe(`/execute/show-image/${image.id}`);
    await expect(host.page.locator(".fullscreen-image img")).toBeVisible();
    // 表示時間で消えない(出したまま)
    await host.page.waitForTimeout(4_000);
    expect(await route(host.page)).toBe(`/execute/show-image/${image.id}`);

    await expectNoHorizontalOverflow(admin.page, "メディア欄/desktop");
    await admin.page.setViewportSize(VIEWPORTS.phone);
    await expectNoHorizontalOverflow(admin.page, "メディア欄/phone");

    await admin.page.getByTestId("media-clear").click();
    await expect.poll(() => route(host.page)).toBe(lobby);
    for (const d of [admin, host]) await d.context.close();
  });

  test("スライドショーを開始すると、ホストはスライドショーの画面になり、「消す」でロビーに戻る", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const { admin, host, lobby } = await scene(browser, request, "メディア(スライドショー)");
    const folder = `e2eshow${uid()}`;
    for (const n of [1, 2]) {
      await seedLocalAsset(host.page, { id: `e2eslide${uid()}`, name: `s${n}.png`, mime: "image/png", body: PNG_1X1, directoryId: `octopus-scheduler/assets/${folder}` });
    }
    await admin.page.getByTestId("media-tab-screen").click();
    await admin.page.getByTestId("media-folder-input").fill(folder);
    await admin.page.getByTestId("media-interval").fill("2");
    await admin.page.getByTestId("media-slideshow-start").click();

    await expect.poll(() => route(host.page)).toMatch(/^\/execute\/show-slideshow\//);
    await expect(host.page.locator(".slideshow-container img.slide")).toBeVisible({ timeout: 20_000 });

    await admin.page.getByTestId("media-clear").click();
    await expect.poll(() => route(host.page)).toBe(lobby);
    for (const d of [admin, host]) await d.context.close();
  });

  test("音楽を再生すると、ホストで再生が始まり、停止で止まる", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const { admin, host, song } = await scene(browser, request, "メディア(音楽)");
    expect(await audioProbe(host.page)).toEqual({ started: 0, stopped: 0 });

    await admin.page.getByTestId(`media-play-${song.id}`).click();
    await expect.poll(async () => (await audioProbe(host.page)).started, { timeout: 30_000 }).toBe(1);
    expect((await audioProbe(host.page)).stopped).toBe(0);

    await admin.page.getByTestId(`media-stop-${song.id}`).click();
    await expect.poll(async () => (await audioProbe(host.page)).stopped, { timeout: 30_000 }).toBe(1);

    // 「すべて停止」は、鳴っていなければ何も起きない
    await admin.page.getByTestId("media-stop-all").click();
    await host.page.waitForTimeout(1_500);
    expect(await audioProbe(host.page)).toEqual({ started: 1, stopped: 1 });
    for (const d of [admin, host]) await d.context.close();
  });

  test("ホストがまだ取っていない素材でも、取ってから表示される", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const { admin, host, image } = await scene(browser, request, "メディア(未取得)");
    // ホストが先読みで取った分を消して、「まだ取っていない」状態にする
    await expect.poll(() => hasLocalAsset(host.page, image.id), { timeout: 30_000 }).toBe(true);
    await deleteLocalAsset(host.page, image.id);
    expect(await hasLocalAsset(host.page, image.id)).toBe(false);

    await admin.page.getByTestId("media-tab-screen").click();
    await admin.page.getByTestId(`media-show-${image.id}`).click();
    await expect.poll(() => route(host.page), { timeout: 30_000 }).toBe(`/execute/show-image/${image.id}`);
    await expect(host.page.locator(".fullscreen-image img")).toBeVisible();
    expect(await hasLocalAsset(host.page, image.id)).toBe(true);
    for (const d of [admin, host]) await d.context.close();
  });
});
