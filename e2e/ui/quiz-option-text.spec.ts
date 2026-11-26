import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, newDevice, seedQuizzes, seedStore, test } from "./fixtures";

/**
 * 会場スクリーンの選択肢は、司会者が読み上げるので省略しない。
 * 長い選択肢(30文字以上、画像あり・なし)でも、全文が文字の枠と帯に収まり、画像ありの帯はカードの高さの 1/3 以下であること。
 */

const IMAGE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#67e8f9"/><circle cx="320" cy="180" r="120" fill="#f59e0b"/></svg>'
);
const IMAGE_NAME = "option.svg";
const IMAGE_HASH = createHash("sha256").update(IMAGE).digest("hex").slice(0, 32);

const TEXTS = [
  "春は満開の桜並木の下で、みんなでお弁当を広げてゆっくり過ごすお花見の会",
  "夏の夜に河川敷で打ち上げ花火を見ながら、屋台のかき氷を食べ比べて回るお祭り",
  "AutumnLeavesViewingTripToTheMountainsWithColleagues2026",
  "冬は温泉旅館に一泊して、雪の降る露天風呂と地元の食材を使った鍋料理を心ゆくまで楽しむ社員旅行。帰りには名物のお土産もたくさん買って帰ります",
];

const quizOf = (id: string, image: string | null) => ({
  id,
  title: "季節クイズ",
  question: "いちばん人気があったのはどれ?",
  options: TEXTS.map((text, i) => ({ no: i + 1, text, color: "#2563eb", image })),
  correctNo: 4,
  timeLimit: 600,
  bgm: null,
});

async function openHost(page: Page, quizId: string, image: boolean) {
  await page.goto("/#/sessions");
  await expect(page.getByPlaceholder("例: 夏祭りイベント")).toBeVisible();
  if (image) await seedStore(page, "quiz-game-blobs", "Blobs", [{ id: IMAGE_HASH, value: { $blob: IMAGE.toString("base64"), type: "image/svg+xml" } }]);
  if (image) {
    const media = { [IMAGE_NAME]: { hash: IMAGE_HASH, mime: "image/svg+xml", size: IMAGE.length } };
    const data = { quizzes: [quizOf(quizId, IMAGE_NAME)], media };
    await seedStore(page, "quiz-game", "QuizData", [{ id: "record", value: { data, updatedAt: Date.now() } }]);
  } else {
    await seedQuizzes(page, [quizOf(quizId, null)]);
  }
}

/** 画面上の選択肢カードの、守れていない条件の一覧(空なら合格)。 */
const violations = (page: Page) =>
  page.locator(".option-card").evaluateAll((cards) =>
    cards.flatMap((card, i) => {
      const text = card.querySelector<HTMLElement>(".option-text")!;
      const ribbon = card.querySelector<HTMLElement>(".text-ribbon")!;
      const found: string[] = [];
      for (const [name, el] of [["text", text], ["ribbon", ribbon]] as const) {
        if (el.scrollWidth > el.clientWidth) found.push(`${i}: ${name} width ${el.scrollWidth} > ${el.clientWidth}`);
        if (el.scrollHeight > el.clientHeight) found.push(`${i}: ${name} height ${el.scrollHeight} > ${el.clientHeight}`);
      }
      const box = (el: Element) => el.getBoundingClientRect();
      const inside = (a: DOMRect, b: DOMRect) => a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && a.left >= b.left - 1 && a.right <= b.right + 1;
      if (!inside(box(text), box(ribbon))) found.push(`${i}: text is outside the ribbon`);
      if (!inside(box(ribbon), box(card))) found.push(`${i}: ribbon is outside the card`);
      // 見えているカード(画像の枠)の高さに対する帯の割合
      const frame = box(card.querySelector(".image-wrapper")!);
      if (card.querySelector("img") && box(ribbon).height > frame.height / 3 + 0.5) {
        found.push(`${i}: ribbon ${box(ribbon).height} > 1/3 of card ${frame.height}`);
      }
      // 出題画面の緊急停止ボタンが、文字に重ならないこと
      const stop = document.querySelector(".emergency-stop-button");
      if (stop) {
        const range = document.createRange();
        range.selectNodeContents(text);
        const s = box(stop);
        const covered = [...range.getClientRects()].some((r) => r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top);
        if (covered) found.push(`${i}: text is covered by the stop button`);
      }
      // 縮めすぎて読めなくならないこと
      const fontSize = parseFloat(getComputedStyle(text).fontSize);
      if (fontSize < 10) found.push(`${i}: font ${fontSize}px is too small`);
      return found;
    })
  );

async function expectFullText(page: Page, texts: string[], image: boolean) {
  await expect(page.locator(".option-text")).toHaveText(texts);
  await expect(page.locator(".option-card img")).toHaveCount(image ? texts.length : 0);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // 画面の大きさが変わった直後は、測り直し(ResizeObserver)が済むまで待つ
  await expect.poll(() => violations(page)).toEqual([]);
}

for (const image of [false, true]) {
  test(`長い選択肢も省略せずに全文を表示する(画像${image ? "あり" : "なし"})`, async ({ browser }) => {
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    const quizId = `qz-option-${image ? "image" : "text"}`;
    await openHost(host.page, quizId, image);

    await host.page.goto(`/#/execute/quiz/${quizId}/play`);
    await expectFullText(host.page, TEXTS, image);
    // 表示中に画面が小さくなっても、測り直して収める(そして大きく戻せる)
    await host.page.setViewportSize({ width: 1280, height: 720 });
    await expectFullText(host.page, TEXTS, image);
    await host.page.setViewportSize({ width: 1920, height: 1080 });
    await expectFullText(host.page, TEXTS, image);

    // 正解画面の大きい表示
    await host.page.goto(`/#/execute/quiz/${quizId}/answer`);
    await expectFullText(host.page, [TEXTS[3]], image);
    await host.page.setViewportSize({ width: 1280, height: 720 });
    await expectFullText(host.page, [TEXTS[3]], image);

    await host.context.close();
  });
}
