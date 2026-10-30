import type { Page } from "@playwright/test";
import { makeBadgePng } from "../../scripts/seed-content.js";
import { ADMIN_TOKEN, adminRpc, createSession, expect, newDevice, openAdvanced, publishPortal, test } from "./fixtures";

/**
 * 名簿の顔写真: 管理者が名簿エディタでメンバーに写真を付けると、一覧にサムネイルが出て、
 * そのメンバーがエントリーすると会場の画面(エントリーのステージ)にも出る。
 * 写真は書き込みが管理者のみ・読み取りはログイン済みなら参加者も、で、差し替え・削除では古いファイルが消える。
 * 参加者・セッションは各テストの中で作り、終わったら消す。
 * 撮影先(E2E_EVIDENCE_DIR)を指定すると、画面のスクリーンショットをそこへ保存する。
 */

const ids = ["ph-e2e-01", "ph-e2e-02", "ph-e2e-03"];
const nameOf = (id: string) => `写真テスト${id.slice(-2)}`;
const keys = new Map<string, string>();
const sessionIds: string[] = [];
const evidenceDir = process.env.E2E_EVIDENCE_DIR;

// 長辺が512pxを大きく超える実寸の写真(縮小されることも確かめる)
const BIG_PHOTO = makeBadgePng("#e11d48", "#1e3a8a", { width: 1600, height: 1200 });
const OTHER_PHOTO = makeBadgePng("#16a34a", "#365314", { width: 900, height: 900 });
// 同じ画像は同じ写真(同じハッシュ)になるので、テストごとに別の画像を使う(共有されると、片方を消してももう片方が使っているので残る)
const REPLACE_FIRST_PHOTO = makeBadgePng("#f59e0b", "#78350f", { width: 1000, height: 800 });
const AUTH_PHOTO = makeBadgePng("#0891b2", "#164e63", { width: 1200, height: 900 });
const photoFile = (buffer: Buffer, name = "face.png") => ({ name, mimeType: "image/png", buffer });

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: nameOf(id) });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

const listed = async (request: Parameters<typeof adminRpc>[0], id: string) =>
  (await adminRpc<Array<{ id: string; photo?: string }>>(request, "accounts_listMembers", {})).find((m) => m.id === id);
/** 名簿に写真が記録されるまで待って、そのハッシュを返す(画面は更新を先に反映するので、サーバーの保存は少し遅れることがある)。 */
const savedPhoto = async (request: Parameters<typeof adminRpc>[0], id: string): Promise<string> => {
  await expect.poll(async () => (await listed(request, id))?.photo, { message: `${id} の写真が名簿に記録される` }).toMatch(/^[0-9a-f]{16}$/);
  return (await listed(request, id))!.photo!;
};
const photoExists = async (request: Parameters<typeof adminRpc>[0], hash: string) =>
  (await adminRpc<{ existing: string[] }>(request, "accounts_existsMemberPhotos", { hashes: [hash] })).existing.includes(hash);

const rowOf = (page: Page, id: string) => page.locator("tbody tr", { hasText: nameOf(id) });

/** 名簿エディタでメンバーの編集ダイアログを開き、写真を選んで保存する。 */
async function setPhotoInEditor(page: Page, id: string, file: ReturnType<typeof photoFile>) {
  await rowOf(page, id).getByRole("button", { name: "編集" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("member-photo-input").setInputFiles(file);
  await expect(dialog.getByTestId("member-photo-preview")).toBeVisible();
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("名簿の顔写真", () => {
  test("管理者が名簿エディタで写真を設定すると、512px以下に縮小され、一覧にサムネイルが出て、再読み込みしても残る", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const rpcNames: string[] = [];
    admin.page.on("request", (r) => {
      if (r.url().endsWith("/rpc")) rpcNames.push(String(r.postDataJSON()?.name));
    });
    await admin.page.goto("/#/settings?tab=members");
    await expect(rowOf(admin.page, ids[0])).toBeVisible();
    await expect(rowOf(admin.page, ids[0]).getByTestId("member-thumb")).toHaveCount(0);

    await setPhotoInEditor(admin.page, ids[0], photoFile(BIG_PHOTO));
    const thumb = rowOf(admin.page, ids[0]).getByTestId("member-thumb");
    await expect(thumb).toBeVisible();
    // 縮小: 長辺512px以内(1600x1200 → 512x384)
    const size = await thumb.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    expect(Math.max(size.w, size.h)).toBe(512);
    expect(size.h).toBe(384);
    // 名簿に写真のハッシュが記録され、写真のファイルがサーバーにある
    const member = { photo: await savedPhoto(request, ids[0]) };
    expect(await photoExists(request, member.photo)).toBe(true);
    // 送信は「存在確認 → 写真の保存 → 名簿の更新」。確認1回、保存1回
    expect(rpcNames.filter((n) => n === "accounts_existsMemberPhotos")).toHaveLength(1);
    expect(rpcNames.filter((n) => n === "accounts_putMemberPhoto")).toHaveLength(1);
    if (evidenceDir) await admin.page.screenshot({ path: `${evidenceDir}/roster-editor-with-photo.png`, fullPage: true });

    // 再読み込み: サムネイルは(端末内キャッシュ or サーバーから)また出る
    await admin.page.reload();
    await expect(rowOf(admin.page, ids[0]).getByTestId("member-thumb")).toBeVisible();
    // 名前だけ直しても写真は残る(組み直しで落ちない)
    await rowOf(admin.page, ids[0]).getByRole("button", { name: "編集" }).click();
    await admin.page.getByRole("dialog").locator("input[type=text]").nth(1).fill(`${nameOf(ids[0])}改`);
    await admin.page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
    await expect(admin.page.locator("tbody tr", { hasText: `${nameOf(ids[0])}改` }).getByTestId("member-thumb")).toBeVisible();
    expect((await listed(request, ids[0]))?.photo).toBe(member.photo);
    await adminRpc(request, "accounts_updateMember", { id: ids[0], name: nameOf(ids[0]) });
    await admin.context.close();
  });

  test("写真を差し替えると古い写真のファイルが消え、外すと名簿から外れてファイルも消える", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/settings?tab=members");
    await setPhotoInEditor(admin.page, ids[1], photoFile(REPLACE_FIRST_PHOTO));
    await expect(rowOf(admin.page, ids[1]).getByTestId("member-thumb")).toBeVisible();
    const first = await savedPhoto(request, ids[1]);
    expect(await photoExists(request, first)).toBe(true);

    await setPhotoInEditor(admin.page, ids[1], photoFile(OTHER_PHOTO));
    await expect.poll(async () => (await listed(request, ids[1]))?.photo).not.toBe(first);
    const second = (await listed(request, ids[1]))!.photo!;
    expect(await photoExists(request, second)).toBe(true);
    await expect.poll(() => photoExists(request, first)).toBe(false);

    await rowOf(admin.page, ids[1]).getByRole("button", { name: "編集" }).click();
    await admin.page.getByTestId("member-photo-clear").click();
    await admin.page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
    await expect(rowOf(admin.page, ids[1]).getByTestId("member-thumb")).toHaveCount(0);
    await expect.poll(async () => (await listed(request, ids[1]))?.photo).toBeUndefined();
    await expect.poll(() => photoExists(request, second)).toBe(false);
    await admin.context.close();
  });

  test("写真の書き込みと存在確認は管理者のみ。参加者は読み取りだけで、未ログインは読み取りもできない", async ({ browser, request }) => {
    await adminRpc(request, "accounts_updateMember", { id: ids[2], name: nameOf(ids[2]) });
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/settings?tab=members");
    await setPhotoInEditor(admin.page, ids[2], photoFile(AUTH_PHOTO));
    await expect(rowOf(admin.page, ids[2]).getByTestId("member-thumb")).toBeVisible();
    const hash = await savedPhoto(request, ids[2]);

    const login = await request.post("/rpc", { data: { name: "accounts_loginWithKey", args: { id: ids[2], key: keys.get(ids[2]) } } });
    const participantToken = (await login.json()).data.token as string;
    const call = async (name: string, token: string | null, args: unknown) =>
      (await (await request.post("/rpc", { data: { name, args: token ? { __octopusAuth: token, args } : args } })).json()) as { status: string; message?: string; data?: any };

    // 参加者: 読み取りだけ(エントリー画面などで顔を出すため)
    const read = await call("accounts_getMemberPhotos", participantToken, { hashes: [hash] });
    expect(read.status).toBe("success");
    expect(read.data.photos[hash]).toMatch(/^data:image\/(webp|jpeg|png);base64,/);
    expect((await call("accounts_putMemberPhoto", participantToken, { hash, dataUrl: "data:image/png;base64,AAAA" })).message).toBe("Unauthorized");
    expect((await call("accounts_existsMemberPhotos", participantToken, { hashes: [hash] })).message).toBe("Unauthorized");
    // 未ログイン: どれも不可
    expect((await call("accounts_getMemberPhotos", null, { hashes: [hash] })).message).toBe("Unauthorized");
    expect((await call("accounts_putMemberPhoto", null, { hash, dataUrl: "data:image/png;base64,AAAA" })).message).toBe("Unauthorized");
    // 管理者でも、画像でないもの・大きすぎるもの・不正なハッシュは断られる
    const adminCall = (name: string, args: unknown) => call(name, ADMIN_TOKEN, args);
    expect((await adminCall("accounts_putMemberPhoto", { hash, dataUrl: "data:text/html;base64,AAAA" })).status).toBe("error");
    expect((await adminCall("accounts_putMemberPhoto", { hash: "../x", dataUrl: "data:image/png;base64,AAAA" })).status).toBe("error");
    expect((await adminCall("accounts_putMemberPhoto", { hash, dataUrl: `data:image/png;base64,${"A".repeat(700_000)}` })).status).toBe("error");
    await admin.context.close();

    // メンバーを削除すると、写真のファイルも消える
    await adminRpc(request, "accounts_deleteMember", { id: ids[2] });
    expect(await photoExists(request, hash)).toBe(false);
    await adminRpc(request, "accounts_addMember", { id: ids[2], name: nameOf(ids[2]) });
    keys.set(ids[2], (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id: ids[2] })).key);
  });

  test("写真つきのメンバーがエントリーすると、会場の画面(エントリーのステージ)にその写真が出る。写真の無い人は頭文字", async ({ browser, request }) => {
    // 写真の準備(名簿エディタ経由)
    const setup = await newDevice(browser, { signedIn: true });
    await setup.page.goto("/#/settings?tab=members");
    await setPhotoInEditor(setup.page, ids[0], photoFile(BIG_PHOTO));
    await expect(rowOf(setup.page, ids[0]).getByTestId("member-thumb")).toBeVisible();
    const hash = await savedPhoto(request, ids[0]);
    await setup.context.close();

    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "写真会場");
    sessionIds.push(sessionId);
    // ホストは写真のキャッシュが空の別端末(=サーバーから取る)
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toContainText("写真会場");
    await publishPortal(request, sessionId);

    await openAdvanced(admin.page);
    await admin.page.getByTestId("event-title").fill("写真つきエントリー");
    await admin.page.getByRole("button", { name: "イベントを開始" }).click();
    await expect(admin.page.getByTestId("event-state")).toContainText("写真つきエントリー");
    await admin.page.getByRole("button", { name: "エントリーした人だけに切り替える" }).click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人のみ");
    await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");
    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "エントリー受付(バブル)" }).click();
    await expect(host.page).toHaveURL(/#\/event-entry$/);

    const withPhoto = await newDevice(browser, { mobile: true });
    const without = await newDevice(browser, { mobile: true });
    await withPhoto.page.goto(`/#/login?id=${ids[0]}&key=${keys.get(ids[0])}`);
    await without.page.goto(`/#/login?id=${ids[1]}&key=${keys.get(ids[1])}`);
    await withPhoto.page.getByTestId("entry-button").click();
    await without.page.getByTestId("entry-button").click();
    await expect(host.page.getByTestId("stage-count")).toHaveText("2");

    const bubbles = host.page.getByTestId("entry-bubble");
    await expect(bubbles).toHaveCount(2);
    const mine = bubbles.filter({ hasText: nameOf(ids[0]) });
    const photo = mine.locator("img");
    await expect(photo).toBeVisible();
    // 画像が実際に読み込まれていて、サーバーに保存した写真(縮小後512x384)そのもの
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(512);
    expect(await photo.getAttribute("src")).toMatch(/^data:image\//);
    // 写真の無い人は頭文字のアバター(画像なし)
    await expect(bubbles.filter({ hasText: nameOf(ids[1]) }).locator("img")).toHaveCount(0);
    if (evidenceDir) await host.page.screenshot({ path: `${evidenceDir}/entry-stage-with-photo.png` });
    // 同じ写真は端末内に残る(ホストが画面を開き直しても、取り直さない)
    const fetches: string[] = [];
    host.page.on("request", (r) => {
      if (r.url().endsWith("/rpc") && r.postDataJSON()?.name === "accounts_getMemberPhotos") fetches.push(String(hash));
    });
    await host.page.reload();
    await expect(host.page.getByTestId("entry-bubble").filter({ hasText: nameOf(ids[0]) }).locator("img")).toBeVisible();
    expect(fetches).toHaveLength(0);

    await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
    for (const d of [withPhoto, without, host, admin]) await d.context.close();
  });
});
