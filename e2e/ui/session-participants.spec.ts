import { adminRpc, addParticipant, createSession, expect, loginByQr, newDevice, publishPortal, removeParticipant, test } from "./fixtures";

/**
 * 参加者名簿: ポータルから入室したメンバーが、セッションの名簿に1人1回だけ載り、
 * ホスト/管理の端末の資格情報で取得できる(PR10 の「自動エントリー」の対象になる)。
 */

const ids = ["pt-e2e-01", "pt-e2e-02", "pt-e2e-03"];
const keys = new Map<string, string>();
const sessionIds: string[] = [];

test.beforeAll(async ({ request }) => {
  for (const id of ids) keys.set(id, await addParticipant(request, id, `参加者${id.slice(-2)}`));
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await removeParticipant(request, id).catch(() => undefined);
});

test("ポータルから3人が入室すると、名簿にその3人だけが載る(再読み込みしても増えない)", async ({ browser, request }) => {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "名簿会場");
  sessionIds.push(sessionId);
  await publishPortal(request, sessionId);

  const op = await adminRpc<{ deviceId: string; token: string }>(request, "sessionHub_joinOperator", { sessionId, role: "admin", label: "E2E" });
  const list = async () =>
    (await adminRpc<{ memberIds: string[] }>(request, "sessionHub_listParticipants", { sessionId, deviceId: op.deviceId, token: op.token })).memberIds;

  expect(await list()).toEqual([]);

  const phones = [];
  for (const id of ids) phones.push(await loginByQr(browser, id, keys.get(id)!));
  expect((await list()).sort()).toEqual([...ids]);

  // 再読み込み(同じ端末への復帰)では増えない
  await phones[0].page.reload();
  await expect(phones[0].page.getByTestId("portal-conn")).toContainText("接続中");
  expect((await list()).sort()).toEqual([...ids]);

  for (const p of phones) await p.context.close();
  await admin.context.close();
});
