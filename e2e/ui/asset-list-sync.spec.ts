import { adminRpc, expect, newDevice, test } from "./fixtures";
import { PNG_1X1, seedServerAsset, uid } from "./helpers/media";

/**
 * 設定>アセットの一覧は、別の端末で入れた素材が、再読み込みなしで(バックグラウンド同期が終わったところで)出る。
 * 初めて開いた端末は、サーバーの素材をあとから取り込むので、開いた時点では空のことがある(以前は、再読み込みするまで空のままだった)。
 */
test("サーバーにある素材は、初めて開いた端末のアセット一覧に、再読み込みなしで出てくる", async ({ browser, request }) => {
  const tag = uid();
  const asset = { id: `e2esync${tag}`, fileName: `sync-${tag}.png`, mime: "image/png", body: Buffer.concat([PNG_1X1, Buffer.from(tag)]) };
  await seedServerAsset(request, asset);
  const d = await newDevice(browser, { signedIn: true });
  try {
    await d.page.goto("/#/settings?tab=assets");
    await expect(d.page.getByRole("row").filter({ hasText: asset.fileName })).toHaveCount(1, { timeout: 90_000 });
  } finally {
    await d.context.close();
    const { json } = await adminRpc<{ json: string | null }>(request, "octopusScheduler_getAssetRecord", {});
    const data: Array<{ id: string }> = json ? JSON.parse(json).data : [];
    await adminRpc(request, "octopusScheduler_saveAssetRecord", { json: JSON.stringify({ updatedAt: Date.now(), data: data.filter((e) => e.id !== asset.id) }) });
  }
});
