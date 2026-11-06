import { expect, test as base } from "@playwright/test";
import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";

export const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-session-token-0001";
export const ADMIN_ID = process.env.E2E_ADMIN_ID ?? "admin";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-password-1234";

/** GAS 実行環境シミュレーター(`npm run e2e -- --target gas`)に対して流しているか。Cloudflare 専用のテストは `test.skip(isGas, "理由")` で外す。 */
export const isGas = process.env.E2E_TARGET === "gas";

export const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } as const;
export const PROJECTOR = { viewport: { width: 1920, height: 1080 } } as const;

export interface Device {
  context: BrowserContext;
  page: Page;
}

/** 別端末を1つ作る。signedIn なら管理者のセッショントークンを localStorage に入れて開始する(ログイン維持の再現)。 */
export async function newDevice(
  browser: Browser,
  options: { signedIn?: boolean; mobile?: boolean; projector?: boolean } = {}
): Promise<Device> {
  const context = await browser.newContext({ ...(options.mobile ? PHONE : options.projector ? PROJECTOR : {}) });
  if (options.signedIn) {
    await context.addInitScript((token) => {
      try {
        if (!localStorage.getItem("octopus-session-token")) localStorage.setItem("octopus-session-token", token);
      } catch {
        // 保存できない環境では未ログインのまま進む
      }
    }, ADMIN_TOKEN);
  }
  const page = await context.newPage();
  // 想定外のエラーを見逃さないため、ページ内の例外とコンソールエラーを集める
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return { context, page };
}

export const errors: string[] = [];

export const test = base.extend({});
export { expect };

/** 管理者のトークンでRPCを呼ぶ(テストの準備・後片付け用)。失敗は例外にする。 */
export async function adminRpc<T = unknown>(request: APIRequestContext, name: string, args: unknown): Promise<T> {
  const res = await request.post("/rpc", { data: { name, args: { __octopusAuth: ADMIN_TOKEN, args } } });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`${name}: ${json.message}`);
  return json.data as T;
}

/** 管理端末でセッションを作成し、id と名前を返す。 */
export async function createSession(page: Page, label: string, options: { demo?: boolean } = {}): Promise<{ id: string; name: string }> {
  // 同じ wrangler 上で他のテストが作ったセッションと取り違えないよう、名前は毎回ユニークにする。
  const name = `${label}-${Math.random().toString(36).slice(2, 7)}`;
  await page.goto("/#/sessions");
  await page.getByPlaceholder("例: 夏祭りイベント").fill(name);
  if (options.demo) await page.getByLabel("デモ(リハーサル)として作る").check();
  await page.getByRole("button", { name: "セッションを作成" }).click();
  const row = page.locator("tbody tr", { hasText: name }).first();
  await expect(row).toBeVisible();
  // 操作画面へ遷移して id を URL から得る
  await row.getByRole("button", { name: "操作する" }).click();
  await page.waitForURL(/#\/session\/console\/[^/]+$/);
  const id = new URL(page.url()).hash.split("/").pop()!;
  return { id, name };
}

/** 架空の参加者アカウントを作り、受付QRのログインキーを返す(テストの準備用)。 */
export async function addParticipant(request: APIRequestContext, id: string, name: string): Promise<string> {
  await adminRpc(request, "accounts_addMember", { id, name });
  return (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key;
}

/** テスト用の参加者(メンバー)を削除する。 */
export const removeParticipant = (request: APIRequestContext, id: string) => adminRpc(request, "accounts_deleteMember", { id });

/** 受付のQRを読み取った想定で、参加者のスマホとしてログインし、ポータルに接続するまで進める。 */
export async function loginByQr(browser: Browser, id: string, key: string): Promise<Device> {
  const d = await newDevice(browser, { mobile: true });
  await d.page.goto(`/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`);
  await expect(d.page.getByTestId("home-greeting")).toBeVisible();
  await expect(d.page.getByTestId("portal-conn")).toContainText("接続中");
  return d;
}

/**
 * 参加者のスマホとしてセッションのポータルに入室させる(ジャックポットの既定の対象「参加者全員(自動)」に入る)。
 * 返した端末は、呼び出し側がテストの最後に閉じる。
 */
export async function joinPortalAs(browser: Browser, request: APIRequestContext, sessionId: string, id: string, key: string): Promise<Device> {
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });
  return loginByQr(browser, id, key);
}

/** セッションを参加者ポータルに公開する / 取り下げる。 */
export const publishPortal = (request: APIRequestContext, sessionId: string, published = true) =>
  adminRpc(request, "sessionHub_setPortalSession", { sessionId, published });

/** 現在のハッシュルート(例: "/jackpot-opening")。 */
export async function route(page: Page): Promise<string> {
  return page.evaluate(() => location.hash.replace(/^#/, ""));
}

/**
 * アプリがローカルDB(localforage = IndexedDB)に持つデータを直接入れる。
 * 形式は {data, updatedAt}。DB/ストアが無ければ作る。
 */
export async function seedStore(
  page: Page,
  dbName: string,
  storeName: string,
  items: Array<{ id: string; value: unknown }>
): Promise<void> {
  // 画面側のアプリが同じ DB を作成・更新している最中だと、ストアの作成と競合して失敗することがある。
  // その場合だけ(NotFoundError / VersionError)、少し待って最初からやり直す。
  for (let attempt = 1; ; attempt++) {
    try {
      await seedStoreOnce(page, dbName, storeName, items);
      return;
    } catch (e) {
      const retryable = /NotFoundError|VersionError|InvalidStateError/.test(String(e));
      if (!retryable || attempt >= 5) throw e;
      await page.waitForTimeout(300 * attempt);
    }
  }
}

async function seedStoreOnce(
  page: Page,
  dbName: string,
  storeName: string,
  items: Array<{ id: string; value: unknown }>
): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, items }) => {
      const open = (version?: number, upgrade?: (db: IDBDatabase) => void) =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const req = version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
          req.onupgradeneeded = () => upgrade?.(req.result);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      let db = await open();
      if (!db.objectStoreNames.contains(storeName)) {
        const next = db.version + 1;
        db.close();
        db = await open(next, (d) => {
          if (!d.objectStoreNames.contains(storeName)) d.createObjectStore(storeName);
        });
      }
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const it of items) store.put({ data: it.value, updatedAt: Date.now() }, it.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { dbName, storeName, items }
  );
}

/**
 * 一覧全体を1件のレコード `{ data, updatedAt }` で持つストア(MemberExtraData など)に、一覧を入れる。
 * 更新日時は「いま」なので、サーバーより新しいものとして同期で送られる。
 */
export async function seedRecord(page: Page, dbName: string, storeName: string, data: unknown[]): Promise<void> {
  await seedStore(page, dbName, storeName, [{ id: "record", value: { data, updatedAt: Date.now() } }]);
}

/** クイズ一覧(`{ quizzes, media }` の1件のレコード)に、素材を持たないクイズを入れる。 */
export async function seedQuizzes(page: Page, quizzes: unknown[]): Promise<void> {
  await seedStore(page, "quiz-game", "QuizData", [{ id: "record", value: { data: { quizzes, media: {} }, updatedAt: Date.now() } }]);
}

/** ジャックポットの景品と画面設定(`{ prizes, screens, media }` の1件のレコード)に、素材を持たない景品・画面設定を入れる。 */
export async function seedJackpot(page: Page, record: { prizes?: unknown[]; screens?: unknown[] }): Promise<void> {
  const data = { prizes: record.prizes ?? [], screens: record.screens ?? [], media: {} };
  await seedStore(page, "jackpot-game", "JackpotData", [{ id: "record", value: { data, updatedAt: Date.now() } }]);
}

/** E2E用のクイズ(正解は2番)。 */
export function sampleQuiz(id: string, timeLimit = 60) {
  return {
    id,
    title: "果物クイズ",
    question: "みかんはどれ?",
    options: [
      { no: 1, text: "りんご", color: "#ef4444", image: null },
      { no: 2, text: "みかん", color: "#f59e0b", image: null },
      { no: 3, text: "ぶどう", color: "#8b5cf6", image: null },
    ],
    correctNo: 2,
    timeLimit,
    bgm: null,
  };
}

/** コントロール画面の「詳細な操作」(普段は閉じている)を開く。画面の直接切り替えやイベント名の指定はここにある。 */
/** 参加者ポータルの下タブから「イベント」を開く（クイズ・抽選・エントリーはこのタブに出る）。 */
export async function openEventTab(page: Page): Promise<void> {
  await page.locator(".pp-tabs__item", { hasText: "イベント" }).click();
  await expect(page).toHaveURL(/#\/p\/event$/);
}

/** 管理コンソールの「詳細」(折りたたまれた操作)を開く。すでに開いていれば何もしない。 */
export async function openAdvanced(page: Page): Promise<void> {
  const details = page.getByTestId("advanced");
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator("summary").click();
}

/** コントロール画面の主ボタン(「次へ」「止める」「受付を締め切る」など。いま押せる操作が1つだけ出る)。 */
export const nextButton = (page: Page) => page.getByTestId("next-button");

/** 確認ダイアログの主操作(「終了する」など)を押す。 */
export async function acceptConfirm(page: Page, label = "終了する"): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}
