import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";
import { AccountsRepository } from "@octopus/accounts";
import type { Member } from "@octopus/accounts";
import { SessionAdminRepository } from "@octopus/session-hub";

const confirmMock = vi.fn(async (_options: unknown) => true);
vi.mock("@octopus/ui-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/ui-kit")>();
  return { ...actual, useConfirm: () => ({ ...actual.useConfirm(), confirm: confirmMock }) };
});
vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin", name: "管理者", isAdmin: true }) }),
}));
// QR画像の生成は呼び出し内容(何を埋め込んだか)だけ確認する。
const qrDataUrl = vi.fn((text: string) => `data:image/gif;fake,${encodeURIComponent(text)}`);
vi.mock("./login-qr", () => ({ qrDataUrl: (text: string) => qrDataUrl(text) }));

import AccountsEditor from "./accounts-editor.vue";

const BASE = "https://app.example/exec";

function makeRepo(accounts: Member[]) {
  let counter = 0;
  const repo = {
    listAccounts: vi.fn(async () => accounts.map((a) => ({ ...a }))),
    issueLoginKey: vi.fn(async (id: string) => {
      const key = `key-${id}-${++counter}`;
      const m = accounts.find((a) => a.id === id)!;
      m.hasLoginKey = true;
      return key;
    }),
  };
  return repo;
}

async function mountEditor(accounts: Member[]) {
  const repo = makeRepo(accounts);
  container.registerInstance(AccountsRepository, repo as unknown as AccountsRepository);
  container.registerInstance(SessionAdminRepository, { appBaseUrl: async () => BASE } as unknown as SessionAdminRepository);
  const wrapper = mount(AccountsEditor, { global: { stubs: { teleport: true } } });
  await flushPromises();
  return { wrapper, repo };
}

const people = (): Member[] => [
  { id: "admin", name: "管理者", isAdmin: true, hasPassword: true },
  { id: "alice", name: "Alice", hasPassword: true },
  { id: "bob", name: "Bob", hasPassword: true, hasLoginKey: true },
  { id: "carol", name: "Carol" },
];

beforeEach(() => {
  container.clearInstances();
  confirmMock.mockReset();
  confirmMock.mockResolvedValue(true);
  qrDataUrl.mockClear();
});

const buttonByLabel = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.findAll("button").find((b) => b.attributes("aria-label") === label);

describe("accounts-editor の受付QR", () => {
  it("管理者の行には発行ボタンが無く、参加者の行には状態に応じた操作が出る", async () => {
    const { wrapper } = await mountEditor(people());
    expect(wrapper.text()).toContain("受付QR");
    expect(buttonByLabel(wrapper, "管理者 の受付QRを発行")).toBeUndefined();
    expect(buttonByLabel(wrapper, "管理者 の受付QRを再発行")).toBeUndefined();
    expect(buttonByLabel(wrapper, "Alice の受付QRを発行")).toBeDefined();
    expect(buttonByLabel(wrapper, "Bob の受付QRを再発行")).toBeDefined();
  });

  it("発行したキーを、ログイン用URL(キーはフラグメント内)としてQRに埋め込む", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await buttonByLabel(wrapper, "Alice の受付QRを発行")!.trigger("click");
    await flushPromises();

    expect(repo.issueLoginKey).toHaveBeenCalledWith("alice");
    expect(qrDataUrl).toHaveBeenCalledTimes(1);
    expect(qrDataUrl).toHaveBeenCalledWith(`${BASE}#/login?id=alice&key=key-alice-1`);
    expect(wrapper.find('[data-testid="login-qr-sheet"]').text()).toContain("Alice");
  });

  it("再発行は確認を取り、キャンセルなら発行しない", async () => {
    const { wrapper, repo } = await mountEditor(people());
    confirmMock.mockResolvedValueOnce(false);
    await buttonByLabel(wrapper, "Bob の受付QRを再発行")!.trigger("click");
    await flushPromises();
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(repo.issueLoginKey).not.toHaveBeenCalled();

    await buttonByLabel(wrapper, "Bob の受付QRを再発行")!.trigger("click");
    await flushPromises();
    expect(repo.issueLoginKey).toHaveBeenCalledWith("bob");
  });

  it("初回の発行では確認を出さない", async () => {
    const { wrapper } = await mountEditor(people());
    await buttonByLabel(wrapper, "Alice の受付QRを発行")!.trigger("click");
    await flushPromises();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("まとめて発行は、未発行の参加者だけを1人ずつ順番に発行する", async () => {
    const { wrapper, repo } = await mountEditor(people());
    const bulk = wrapper.findAll("button").find((b) => b.text().includes("未発行の参加者に受付QRを発行"))!;
    expect(bulk.text()).toContain("2人");
    await bulk.trigger("click");
    await flushPromises();

    expect(repo.issueLoginKey.mock.calls.map((c) => c[0])).toEqual(["alice", "carol"]);
    expect(qrDataUrl).toHaveBeenCalledTimes(2);
  });

  it("途中で失敗しても、そこまでに発行できた分はシートに出す", async () => {
    const { wrapper, repo } = await mountEditor(people());
    repo.issueLoginKey.mockImplementationOnce(async () => "key-alice-ok").mockRejectedValueOnce(new Error("boom"));
    const bulk = wrapper.findAll("button").find((b) => b.text().includes("未発行の参加者に受付QRを発行"))!;
    await bulk.trigger("click");
    await flushPromises();

    expect(qrDataUrl).toHaveBeenCalledTimes(1);
    expect(qrDataUrl).toHaveBeenCalledWith(`${BASE}#/login?id=alice&key=key-alice-ok`);
    expect(wrapper.find('[data-testid="login-qr-sheet"]').text()).toContain("Alice");
    expect(wrapper.find('[data-testid="login-qr-sheet"]').text()).not.toContain("Carol");
  });

  it("未発行の参加者がいなければ、まとめて発行は押せない", async () => {
    const { wrapper } = await mountEditor([{ id: "admin", name: "管理者", isAdmin: true }, { id: "bob", name: "Bob", hasLoginKey: true }]);
    const bulk = wrapper.findAll("button").find((b) => b.text().includes("未発行の参加者に受付QRを発行"))!;
    expect(bulk.attributes("disabled")).toBeDefined();
  });
});
