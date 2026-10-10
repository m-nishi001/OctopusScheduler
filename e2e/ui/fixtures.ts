import { expect, test as base } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

export const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-session-token-0001";
export const ADMIN_ID = process.env.E2E_ADMIN_ID ?? "admin";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-password-1234";

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

/** 管理端末でセッションを作成し、一覧から id と参加コードを返す。 */
export async function createSession(page: Page, label: string, options: { demo?: boolean } = {}): Promise<{ id: string; code: string; name: string }> {
  // 同じ wrangler 上で他のテストが作ったセッションと取り違えないよう、名前は毎回ユニークにする。
  const name = `${label}-${Math.random().toString(36).slice(2, 7)}`;
  await page.goto("/#/sessions");
  await page.getByPlaceholder("例: 夏祭りイベント").fill(name);
  if (options.demo) await page.getByLabel("デモ(リハーサル)として作る").check();
  await page.getByRole("button", { name: "セッションを作成" }).click();
  const row = page.locator("tbody tr", { hasText: name }).first();
  await expect(row).toBeVisible();
  const code = (await row.locator(".sessions__code").innerText()).trim();
  // 操作画面へ遷移して id を URL から得る
  await row.getByRole("button", { name: "操作する" }).click();
  await page.waitForURL(/#\/session\/console\/[^/]+$/);
  const id = new URL(page.url()).hash.split("/").pop()!;
  return { id, code, name };
}

/**
 * 参加者としてポータルに入る(QRのURLを開いた想定)。名簿(メンバー)がある環境では名前を選ぶ画面が
 * 出るので「参加する」を押し、無い環境では自動で参加する。どちらでも参加済みの状態まで進める。
 */
export async function joinPortal(page: Page, code: string): Promise<void> {
  await page.goto(`/#/portal/${code}`);
  const session = page.locator(".portal__session");
  const button = page.getByRole("button", { name: "参加する" });
  await expect(session.or(button)).toBeVisible();
  if (await button.isVisible()) await button.click();
  await expect(session).toBeVisible();
}

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
