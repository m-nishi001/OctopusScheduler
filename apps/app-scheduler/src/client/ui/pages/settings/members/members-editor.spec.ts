import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";
import { AccountsRepository, MemberPhotoCache } from "@octopus/accounts";
import type { Member } from "@octopus/accounts";
import { SessionAdminRepository } from "@octopus/session-hub";

const confirmMock = vi.fn(async (_options: unknown) => true);
const confirmDeleteMock = vi.fn(async (_message: string) => true);
const toastError = vi.fn();
vi.mock("@octopus/ui-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/ui-kit")>();
  return {
    ...actual,
    toast: { ...actual.toast, error: (m: string) => toastError(m) },
    useConfirm: () => ({ ...actual.useConfirm(), confirm: confirmMock, confirmDelete: confirmDeleteMock }),
  };
});
vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin", name: "管理者", isAdmin: true }) }),
}));
// 写真の縮小・送信は、呼び出し内容だけ確認する。
const preparePhoto = vi.fn(async (_file: File) => ({ hash: "0123456789abcdef", dataUrl: "data:image/jpeg;base64,AAAA" }));
const uploadMemberPhotos = vi.fn(async (_repo: unknown, _photos: unknown[]) => undefined);
vi.mock("@octopus/accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/accounts")>();
  return {
    ...actual,
    preparePhoto: (file: File) => preparePhoto(file),
    uploadMemberPhotos: (repo: unknown, photos: unknown[]) => uploadMemberPhotos(repo, photos),
  };
});
// QR画像の生成は呼び出し内容(何を埋め込んだか)だけ確認する。
const qrDataUrl = vi.fn((text: string) => `data:image/gif;fake,${encodeURIComponent(text)}`);
vi.mock("./login-qr", () => ({ qrDataUrl: (text: string) => qrDataUrl(text) }));

import MembersEditor from "./members-editor.vue";

const BASE = "https://app.example/exec";

function makeRepo(accounts: Member[], usage: unknown = { members: 4, usedBytes: 100, maxBytes: null }) {
  let counter = 0;
  const repo = {
    listAccounts: vi.fn(async () => accounts.map((a) => ({ ...a }))),
    // 名簿の画面は listMembers を読まない(読むのは書き出しのときだけ)
    listMembers: vi.fn(async () => accounts.map(({ hasPassword: _p, hasLoginKey: _k, ...m }) => m)),
    getRosterUsage: vi.fn(async () => usage),
    addMember: vi.fn(async (input: Member) => {
      accounts.push({ ...input });
      return input;
    }),
    updateMember: vi.fn(async (input: Member) => {
      const i = accounts.findIndex((a) => a.id === input.id);
      accounts[i] = { ...accounts[i], ...input };
      return accounts[i];
    }),
    deleteMember: vi.fn(async (id: string) => {
      accounts.splice(accounts.findIndex((a) => a.id === id), 1);
    }),
    setPassword: vi.fn(async (_id: string, _pw: string) => undefined),
    issueLoginKey: vi.fn(async (id: string) => {
      const key = `key-${id}-${++counter}`;
      const m = accounts.find((a) => a.id === id)!;
      m.hasLoginKey = true;
      return key;
    }),
  };
  return repo;
}

const photoCache = () => ({
  ensure: vi.fn(async (_hashes: unknown[]) => undefined),
  get: vi.fn((hash: string | undefined) => (hash === "aaaaaaaaaaaaaaaa" ? "data:image/jpeg;base64,THUMB" : undefined)),
  remember: vi.fn(async (_hash: string, _url: string) => undefined),
});

function register(repo: ReturnType<typeof makeRepo>, photos = photoCache()) {
  container.registerInstance(AccountsRepository, repo as unknown as AccountsRepository);
  container.registerInstance(MemberPhotoCache, photos as unknown as MemberPhotoCache);
  container.registerInstance(SessionAdminRepository, { appBaseUrl: async () => BASE } as unknown as SessionAdminRepository);
  return photos;
}

async function mountEditor(accounts: Member[], usage?: unknown) {
  const repo = makeRepo(accounts, usage);
  const photos = register(repo);
  const wrapper = mount(MembersEditor, { global: { stubs: { teleport: true } } });
  await flushPromises();
  return { wrapper, repo, photos };
}

const people = (): Member[] => [
  { id: "admin", name: "管理者", isAdmin: true, hasPassword: true },
  { id: "alice", name: "Alice", hasPassword: true, photo: "aaaaaaaaaaaaaaaa" },
  { id: "bob", name: "Bob", hasPassword: true, hasLoginKey: true },
  { id: "carol", name: "Carol" },
];

beforeEach(() => {
  container.clearInstances();
  confirmMock.mockReset();
  confirmMock.mockResolvedValue(true);
  confirmDeleteMock.mockReset();
  confirmDeleteMock.mockResolvedValue(true);
  toastError.mockClear();
  qrDataUrl.mockClear();
  preparePhoto.mockClear();
  uploadMemberPhotos.mockClear();
});

type Wrapper = Awaited<ReturnType<typeof mountEditor>>["wrapper"];
const buttonByLabel = (wrapper: Wrapper, label: string) =>
  wrapper.findAll("button").find((b) => b.attributes("aria-label") === label);
const buttonByText = (wrapper: Wrapper, text: string) => wrapper.findAll("button").find((b) => b.text().includes(text));
const rowOf = (wrapper: Wrapper, text: string) => wrapper.findAll("tbody tr").find((r) => r.text().includes(text))!;
const save = (wrapper: Wrapper) => buttonByText(wrapper, "保存")!;

describe("members-editor の一覧", () => {
  it("名簿を listAccounts で1回だけ読み、ID・写真・名前・権限・パスワード・受付QR・操作の列を出す", async () => {
    const { wrapper, repo } = await mountEditor(people());
    expect(repo.listAccounts).toHaveBeenCalledTimes(1);
    expect(repo.listMembers).not.toHaveBeenCalled();

    const heads = wrapper.findAll("thead th").map((th) => th.text());
    expect(heads).toEqual(expect.arrayContaining(["ID", "写真", "名前", "権限", "パスワード", "受付QR", "操作"]));
    const alice = rowOf(wrapper, "Alice").text();
    expect(alice).toContain("一般");
    expect(alice).toContain("設定済み");
    expect(alice).toContain("未発行");
    expect(rowOf(wrapper, "Bob").text()).toContain("発行済み");
    expect(rowOf(wrapper, "Carol").text()).toContain("未設定");
    expect(rowOf(wrapper, "管理者").text()).toContain("管理者");
    expect(wrapper.text()).toContain("4件");
  });

  it("写真があればサムネイル、なければ頭文字を出す", async () => {
    const { wrapper, photos } = await mountEditor(people());
    expect(photos.ensure).toHaveBeenCalledWith(["aaaaaaaaaaaaaaaa"]);
    expect(rowOf(wrapper, "Alice").find('[data-testid="member-thumb"]').attributes("src")).toBe("data:image/jpeg;base64,THUMB");
    expect(rowOf(wrapper, "Bob").find('[data-testid="member-thumb"]').exists()).toBe(false);
    expect(rowOf(wrapper, "Bob").text()).toContain("B");
  });

  it("追加・書き出し・取り込みが同じ画面にあり、「アカウント追加」という別の入口は無い", async () => {
    const { wrapper } = await mountEditor(people());
    expect(wrapper.find('[data-testid="member-add"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="table-export"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="table-export-media"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="table-import-open"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("アカウント追加");
  });

  it("パスワード設定済みの管理者がいなければ警告する", async () => {
    const warning = "パスワード設定済みの管理者がいません";
    const none = await mountEditor([{ id: "admin", name: "管理者", isAdmin: true }, { id: "a", name: "A", hasPassword: true }]);
    expect(none.wrapper.text()).toContain(warning);
    const ok = await mountEditor(people());
    expect(ok.wrapper.text()).not.toContain(warning);
  });

  it("名簿の容量は、上限があるときだけ表示し、80%を超えたら警告として出す", async () => {
    const unlimited = await mountEditor(people());
    expect(unlimited.wrapper.find('[data-testid="roster-capacity"]').exists()).toBe(false);

    const near = await mountEditor(people(), { members: 120, usedBytes: 85, maxBytes: 100 });
    const el = near.wrapper.find('[data-testid="roster-capacity"]');
    expect(el.text()).toContain("85%");
    expect(el.attributes("role")).toBe("alert");
    expect(el.classes()).toContain("is-warn");
  });

  it("容量の取得に失敗しても一覧は出る", async () => {
    const repo = makeRepo(people());
    repo.getRosterUsage.mockRejectedValue(new Error("x"));
    register(repo);
    const wrapper = mount(MembersEditor, { global: { stubs: { teleport: true } } });
    await flushPromises();
    expect(wrapper.text()).toContain("Alice");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("一覧の取得に失敗したら、エラーを知らせる", async () => {
    const repo = makeRepo(people());
    repo.listAccounts.mockRejectedValue(new Error("boom"));
    register(repo);
    mount(MembersEditor, { global: { stubs: { teleport: true } } });
    await flushPromises();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});

describe("members-editor の追加・編集", () => {
  it("追加: ID・名前・管理者・パスワードを入れて保存すると、作成してからパスワードを設定する", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await wrapper.find('[data-testid="member-add"]').trigger("click");
    const inputs = wrapper.findAll(".members-editor__form input[type=text]");
    await inputs[0].setValue(" dave ");
    await inputs[1].setValue(" Dave ");
    await wrapper.find('[data-testid="member-is-admin"]').setValue(true);
    await wrapper.find('[data-testid="member-password"]').setValue("password-1");
    await save(wrapper).trigger("click");
    await flushPromises();

    expect(repo.addMember).toHaveBeenCalledWith({ id: "dave", name: "Dave", isAdmin: true, photo: undefined });
    expect(repo.setPassword).toHaveBeenCalledWith("dave", "password-1");
    expect(repo.addMember.mock.invocationCallOrder[0]).toBeLessThan(repo.setPassword.mock.invocationCallOrder[0]);
    expect(wrapper.text()).toContain("Dave");
  });

  it("追加: IDか名前が空、またはパスワードが8文字未満なら保存できない", async () => {
    const { wrapper } = await mountEditor(people());
    await wrapper.find('[data-testid="member-add"]').trigger("click");
    const disabled = () => save(wrapper).attributes("disabled") !== undefined;
    expect(disabled()).toBe(true);
    const inputs = wrapper.findAll(".members-editor__form input[type=text]");
    await inputs[0].setValue("dave");
    expect(disabled()).toBe(true);
    await inputs[1].setValue("Dave");
    expect(disabled()).toBe(false);
    await wrapper.find('[data-testid="member-password"]').setValue("short");
    expect(disabled()).toBe(true);
    await wrapper.find('[data-testid="member-password"]').setValue("long-enough");
    expect(disabled()).toBe(false);
  });

  it("編集: IDは変えられず、パスワード空欄なら設定し直さず、写真は触らない(省略=そのまま)", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await rowOf(wrapper, "Alice").find('button[aria-label="編集"]').trigger("click");
    const inputs = wrapper.findAll(".members-editor__form input[type=text]");
    expect((inputs[0].element as HTMLInputElement).disabled).toBe(true);
    expect((inputs[0].element as HTMLInputElement).value).toBe("alice");
    // 現在の写真が編集画面にも出る
    expect(wrapper.find('[data-testid="member-photo-preview"]').attributes("src")).toBe("data:image/jpeg;base64,THUMB");
    await inputs[1].setValue("Alice2");
    await save(wrapper).trigger("click");
    await flushPromises();

    expect(repo.updateMember).toHaveBeenCalledWith({ id: "alice", name: "Alice2", isAdmin: false, photo: undefined });
    expect(repo.setPassword).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Alice2");
  });

  it("編集: 管理者にしてパスワードを設定できる", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await rowOf(wrapper, "Carol").find('button[aria-label="編集"]').trigger("click");
    expect((wrapper.find('[data-testid="member-is-admin"]').element as HTMLInputElement).checked).toBe(false);
    await wrapper.find('[data-testid="member-is-admin"]').setValue(true);
    await wrapper.find('[data-testid="member-password"]').setValue("password-2");
    await save(wrapper).trigger("click");
    await flushPromises();
    expect(repo.updateMember).toHaveBeenCalledWith({ id: "carol", name: "Carol", isAdmin: true, photo: undefined });
    expect(repo.setPassword).toHaveBeenCalledWith("carol", "password-2");
  });

  it("編集: 「写真を外す」を押して保存すると、写真を空文字(外す)で送る", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await rowOf(wrapper, "Alice").find('button[aria-label="編集"]').trigger("click");
    await wrapper.find('[data-testid="member-photo-clear"]').trigger("click");
    expect(wrapper.find('[data-testid="member-photo-preview"]').exists()).toBe(false);
    await save(wrapper).trigger("click");
    await flushPromises();
    expect(repo.updateMember).toHaveBeenCalledWith(expect.objectContaining({ id: "alice", photo: "" }));
  });

  it("編集: 写真を選ぶと縮小して送り、そのハッシュを名簿に記録する", async () => {
    const { wrapper, repo, photos } = await mountEditor(people());
    await rowOf(wrapper, "Carol").find('button[aria-label="編集"]').trigger("click");
    const input = wrapper.find('[data-testid="member-photo-input"]');
    const file = new File(["x"], "face.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file], configurable: true });
    await input.trigger("change");
    await flushPromises();

    expect(preparePhoto).toHaveBeenCalledWith(file);
    expect(uploadMemberPhotos).toHaveBeenCalledTimes(1);
    expect(photos.remember).toHaveBeenCalledWith("0123456789abcdef", "data:image/jpeg;base64,AAAA");
    expect(wrapper.find('[data-testid="member-photo-preview"]').attributes("src")).toBe("data:image/jpeg;base64,AAAA");

    await save(wrapper).trigger("click");
    await flushPromises();
    expect(repo.updateMember).toHaveBeenCalledWith(expect.objectContaining({ id: "carol", photo: "0123456789abcdef" }));
  });

  it("写真の処理に失敗したら、エラーを出して写真は変えない", async () => {
    const { wrapper, repo } = await mountEditor(people());
    preparePhoto.mockRejectedValueOnce(new Error("画像を読めません"));
    await rowOf(wrapper, "Carol").find('button[aria-label="編集"]').trigger("click");
    const input = wrapper.find('[data-testid="member-photo-input"]');
    Object.defineProperty(input.element, "files", { value: [new File(["x"], "f.png")], configurable: true });
    await input.trigger("change");
    await flushPromises();
    expect(wrapper.text()).toContain("写真を保存できませんでした: 画像を読めません");
    await save(wrapper).trigger("click");
    await flushPromises();
    expect(repo.updateMember).toHaveBeenCalledWith(expect.objectContaining({ id: "carol", photo: undefined }));
  });

  it("ログイン中の自分の管理者権限は外せない", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await rowOf(wrapper, "管理者").find('button[aria-label="編集"]').trigger("click");
    await wrapper.find('[data-testid="member-is-admin"]').setValue(false);
    await save(wrapper).trigger("click");
    await flushPromises();
    expect(repo.updateMember).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("ログイン中のアカウントの管理者権限は外せません");
  });

  it("サーバーが保存を断ったら、理由を表示してダイアログを閉じない", async () => {
    const { wrapper, repo } = await mountEditor(people());
    repo.updateMember.mockRejectedValueOnce(new Error("名簿が満杯です"));
    await rowOf(wrapper, "Carol").find('button[aria-label="編集"]').trigger("click");
    await save(wrapper).trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("名簿が満杯です");
    expect(wrapper.find(".members-editor__form").exists()).toBe(true);
  });
});

describe("members-editor の削除", () => {
  it("確認してから削除し、一覧を読み直す", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await rowOf(wrapper, "Carol").find('button[aria-label="削除"]').trigger("click");
    await flushPromises();
    expect(confirmDeleteMock).toHaveBeenCalledWith("「Carol」を削除しますか?");
    expect(repo.deleteMember).toHaveBeenCalledWith("carol");
    expect(wrapper.text()).not.toContain("Carol");
  });

  it("確認でキャンセルしたら削除しない", async () => {
    const { wrapper, repo } = await mountEditor(people());
    confirmDeleteMock.mockResolvedValueOnce(false);
    await rowOf(wrapper, "Carol").find('button[aria-label="削除"]').trigger("click");
    await flushPromises();
    expect(repo.deleteMember).not.toHaveBeenCalled();
  });

  it("ログイン中の自分は削除できない(確認も出さない)", async () => {
    const { wrapper, repo } = await mountEditor(people());
    await rowOf(wrapper, "管理者").find('button[aria-label="削除"]').trigger("click");
    await flushPromises();
    expect(confirmDeleteMock).not.toHaveBeenCalled();
    expect(repo.deleteMember).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("ログイン中のアカウントは削除できません");
  });

  it("選択した複数人をまとめて削除できる。自分が含まれていれば何も消さない", async () => {
    const { wrapper, repo } = await mountEditor(people());
    const check = (text: string) => rowOf(wrapper, text).find('input[type="checkbox"]');
    await check("Bob").setValue(true);
    await check("Carol").setValue(true);
    await buttonByText(wrapper, "選択を削除(2)")!.trigger("click");
    await flushPromises();
    expect(repo.deleteMember.mock.calls.map((c) => c[0])).toEqual(["bob", "carol"]);

    repo.deleteMember.mockClear();
    await check("管理者").setValue(true);
    await check("Alice").setValue(true);
    await buttonByText(wrapper, "選択を削除(2)")!.trigger("click");
    await flushPromises();
    expect(repo.deleteMember).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("ログイン中のアカウントは削除できません");
  });

  it("削除に失敗したらエラーを知らせる", async () => {
    const { wrapper, repo } = await mountEditor(people());
    repo.deleteMember.mockRejectedValueOnce(new Error("busy"));
    await rowOf(wrapper, "Carol").find('button[aria-label="削除"]').trigger("click");
    await flushPromises();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("busy"));
  });
});

describe("members-editor の受付QR", () => {
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
    const bulk = buttonByText(wrapper, "未発行の参加者に受付QRを発行")!;
    expect(bulk.text()).toContain("2人");
    await bulk.trigger("click");
    await flushPromises();

    expect(repo.issueLoginKey.mock.calls.map((c) => c[0])).toEqual(["alice", "carol"]);
    expect(qrDataUrl).toHaveBeenCalledTimes(2);
    // 発行後は一覧が読み直され、まとめて発行は押せなくなる
    expect(rowOf(wrapper, "Alice").text()).toContain("発行済み");
    expect(buttonByText(wrapper, "未発行の参加者に受付QRを発行")!.attributes("disabled")).toBeDefined();
  });

  it("シートには印刷ボタンがあり、押すと印刷を始める。閉じると中身を捨てる", async () => {
    const { wrapper } = await mountEditor(people());
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await buttonByLabel(wrapper, "Alice の受付QRを発行")!.trigger("click");
    await flushPromises();
    await buttonByText(wrapper, "印刷")!.trigger("click");
    expect(print).toHaveBeenCalledTimes(1);
    await buttonByText(wrapper, "閉じる")!.trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="login-qr-sheet"]').exists()).toBe(false);
    print.mockRestore();
  });

  it("途中で失敗しても、そこまでに発行できた分はシートに出す", async () => {
    const { wrapper, repo } = await mountEditor(people());
    repo.issueLoginKey.mockImplementationOnce(async () => "key-alice-ok").mockRejectedValueOnce(new Error("boom"));
    await buttonByText(wrapper, "未発行の参加者に受付QRを発行")!.trigger("click");
    await flushPromises();

    expect(qrDataUrl).toHaveBeenCalledTimes(1);
    expect(qrDataUrl).toHaveBeenCalledWith(`${BASE}#/login?id=alice&key=key-alice-ok`);
    expect(wrapper.find('[data-testid="login-qr-sheet"]').text()).toContain("Alice");
    expect(wrapper.find('[data-testid="login-qr-sheet"]').text()).not.toContain("Carol");
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });

  it("未発行の参加者がいなければ、まとめて発行は押せない", async () => {
    const { wrapper } = await mountEditor([{ id: "admin", name: "管理者", isAdmin: true }, { id: "bob", name: "Bob", hasLoginKey: true }]);
    expect(buttonByText(wrapper, "未発行の参加者に受付QRを発行")!.attributes("disabled")).toBeDefined();
  });
});
