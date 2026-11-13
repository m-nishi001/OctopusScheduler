import { adminRpc, createSession, expect, newDevice, route, test } from "./fixtures";
import type { Browser } from "@playwright/test";
import { expectNoHorizontalOverflow, VIEWPORTS } from "./helpers/responsive";
import { addAssetInSettings, audioProbe, deleteLocalBlob, hasLocalBlob, holdUploads, installAudioProbe, PNG_1X1, removeServerAsset, seedServerAsset, serverHasAsset, silentWav, uid } from "./helpers/media";

/**
 * 管理端末の「音楽・スクリーン」から、ホスト(投影)の画面と音楽を動かす。
 * 管理端末とホストの2つの端末で、media の指示(再生・停止・表示・消す)が届くことを確かめる。
 */
const sessionIds: string[] = [];
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
});

async function scene(browser: Browser, request: import("@playwright/test").APIRequestContext, label: string, extraAssets: Parameters<typeof seedServerAsset>[1][] = []) {
  const tag = uid();
  const image = { id: `e2eimg${tag}`, fileName: `e2e-pic-${tag}.png`, mime: "image/png", body: Buffer.concat([PNG_1X1, Buffer.from(tag)]) };
  const song = { id: `e2esong${tag}`, fileName: `e2e-tone-${tag}.wav`, mime: "audio/wav", body: silentWav() };
  await seedServerAsset(request, image);
  await seedServerAsset(request, song);
  // ホストが入室する前に入れておく素材(ホストは、この端末の一覧を使うので、入室後にサーバーへ足しても、次の同期まで見えない)
  for (const asset of extraAssets) await seedServerAsset(request, asset);

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
    const folder = `e2eshow${uid()}`;
    // 中身が 1 件ずつ違う画像(同じ中身は同じハッシュのファイルになる)
    const slides = [1, 2].map((n) => ({ id: `e2eslide${uid()}`, fileName: `s${n}.png`, mime: "image/png", body: Buffer.concat([PNG_1X1, Buffer.from(`${folder}${n}`)]), directoryId: `octopus-scheduler/assets/${folder}` }));
    const { admin, host, lobby } = await scene(browser, request, "メディア(スライドショー)", slides);
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
    await expect.poll(() => hasLocalBlob(host.page, image.body), { timeout: 30_000 }).toBe(true);
    await deleteLocalBlob(host.page, image.body);
    expect(await hasLocalBlob(host.page, image.body)).toBe(false);

    await admin.page.getByTestId("media-tab-screen").click();
    await admin.page.getByTestId(`media-show-${image.id}`).click();
    await expect.poll(() => route(host.page), { timeout: 30_000 }).toBe(`/execute/show-image/${image.id}`);
    await expect(host.page.locator(".fullscreen-image img")).toBeVisible();
    expect(await hasLocalBlob(host.page, image.body)).toBe(true);
    for (const d of [admin, host]) await d.context.close();
  });

  test("ホストで素材を追加すると、アップロードが終わる前から管理端末の一覧に出て再生でき、終わったあとも重複しない", async ({ browser, request }) => {
    test.setTimeout(150_000);
    const { admin, host } = await scene(browser, request, "メディア(アップロード前)");
    const uploads = await holdUploads(host.page);
    const tag = uid();
    const name = `e2e-pending-${tag}.wav`;
    await addAssetInSettings(host.page, { name, mimeType: "audio/wav", buffer: Buffer.concat([silentWav(), Buffer.from(tag)]) });

    // 再読み込みを押さなくても、アップロード前の素材が管理端末の一覧に出る(サーバーにはまだ無い)
    const rows = admin.page.getByTestId("media-song").filter({ hasText: name });
    await expect(rows).toHaveCount(1, { timeout: 20_000 });
    expect(await serverHasAsset(request, name)).toBe(false);

    // 再生の指示は、ホストのこの端末にある中身で鳴る(ホストは設定画面にいても鳴らせる)
    await rows.getByRole("button", { name: "再生" }).click();
    await expect.poll(async () => (await audioProbe(host.page)).started, { timeout: 30_000 }).toBe(1);

    // アップロードが終わると、サーバーの一覧に載り、管理端末の一覧は重複せず1件のまま
    uploads.release();
    await expect.poll(() => serverHasAsset(request, name), { timeout: 60_000 }).toBe(true);
    await admin.page.waitForTimeout(3_000);
    await expect(rows).toHaveCount(1);
    for (const d of [admin, host]) await d.context.close();
  });

  test("ホストを替えると、アップロード前の素材は一覧から消え、アップロード済みの素材は新しいホストで再生できる", async ({ browser, request }) => {
    test.setTimeout(150_000);
    const { admin, host, song, sessionId } = await scene(browser, request, "メディア(ホスト交代)");
    await holdUploads(host.page); // 旧ホストの素材は、最後までアップロードされない
    const tag = uid();
    const name = `e2e-lost-${tag}.wav`;
    await addAssetInSettings(host.page, { name, mimeType: "audio/wav", buffer: Buffer.concat([silentWav(), Buffer.from(tag)]) });
    await expect(admin.page.getByTestId("media-song").filter({ hasText: name })).toHaveCount(1, { timeout: 20_000 });

    // 別の端末が、ホストを引き継ぐ
    const host2 = await newDevice(browser, { signedIn: true, projector: true });
    await installAudioProbe(host2.context);
    await host2.page.goto(`/#/session/host/${sessionId}`);
    await host2.page.getByRole("button", { name: "引き継ぐ" }).click();
    await expect(host2.page.locator(".host-view__title")).toBeVisible();

    // アップロード前だった素材は、一覧から消える。アップロード済みの素材は残り、新しいホストで再生できる
    await expect(admin.page.getByTestId("media-song").filter({ hasText: name })).toHaveCount(0, { timeout: 30_000 });
    await expect(admin.page.getByTestId(`media-play-${song.id}`)).toBeVisible();
    await admin.page.getByTestId(`media-play-${song.id}`).click();
    await expect.poll(async () => (await audioProbe(host2.page)).started, { timeout: 60_000 }).toBe(1);
    for (const d of [admin, host, host2]) await d.context.close();
  });

  test("ホストで再生できない素材を指示すると、管理端末にエラーが出る", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const { admin, host, song } = await scene(browser, request, "メディア(再生失敗)");
    await expect.poll(() => hasLocalBlob(host.page, song.body), { timeout: 30_000 }).toBe(true);
    await host.page.waitForTimeout(4_000); // 入室直後の同期が終わるのを待つ(そのあとの変更を、ホストがすぐ取り込まないようにする)
    // サーバーから素材を外し、ホストの中身も消す。管理端末の一覧は古いまま(再生できる素材に見える)
    await removeServerAsset(request, song.id);
    await deleteLocalBlob(host.page, song.body);

    await admin.page.getByTestId(`media-play-${song.id}`).click();
    await expect(admin.page.getByTestId("media-playback-error")).toContainText(new RegExp(`${song.fileName}|${song.id}`), { timeout: 30_000 });
    expect((await audioProbe(host.page)).started).toBe(0);
    for (const d of [admin, host]) await d.context.close();
  });
});

test.describe("設定: 未アップロードの件数", () => {
  test("設定を離れてもアップロードは続き、戻ると「未アップロード 0 件」になっている", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const device = await newDevice(browser, { signedIn: true });
    const { page } = device;
    const uploads = await holdUploads(page);
    const tag = uid();
    const name = `e2e-leave-${tag}.png`;
    await addAssetInSettings(page, { name, mimeType: "image/png", buffer: Buffer.concat([PNG_1X1, Buffer.from(tag)]) });
    await expect(page.getByTestId("pending-upload")).toHaveText("未アップロード 1 件");

    // 設定を離れてから、アップロードを進める
    await page.goto("/#/home");
    uploads.release();
    await expect.poll(() => serverHasAsset(request, name), { timeout: 60_000 }).toBe(true);

    await page.goto("/#/settings?tab=assets");
    await expect(page.getByTestId("pending-upload")).toHaveText("未アップロード 0 件");
    await device.context.close();
  });
});
