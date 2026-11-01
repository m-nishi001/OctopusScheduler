import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";
import type { App } from "vue";
import { container } from "tsyringe";

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@octopus/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@octopus/ui-kit")>()),
  useConfirm: () => ({ confirmDelete: async () => true }),
}));

import QuizList from "./quiz-list.vue";
import { GetAllQuizzesUseCase } from "../../../../control/use-cases/get-all-quizzes-use-case";
import { AddQuizUseCase } from "../../../../control/use-cases/add-quiz-use-case";
import { UpdateQuizUseCase } from "../../../../control/use-cases/update-quiz-use-case";
import { DeleteQuizUseCase } from "../../../../control/use-cases/delete-quiz-use-case";
import { QuizRepository } from "../../../../model/quiz-repository";

const dto = (id: string) => ({ id, title: `クイズ${id}`, question: "?", correctNo: 1, timeLimit: 30, options: [], bgm: null });
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

let app: App | undefined;
let host: HTMLElement | undefined;
const execute = vi.fn();
const buttons = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("button"));
const buttonText = () => buttons().map((b) => (b.textContent ?? "").replace(/\s+/g, ""));
const byText = (text: string) => buttons().find((b) => (b.textContent ?? "").replace(/\s+/g, "").includes(text))!;

async function mountList() {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp(QuizList);
  app.mount(host);
  await settle();
}

beforeEach(() => {
  execute.mockReset().mockResolvedValue(undefined);
  container.register(GetAllQuizzesUseCase, { useValue: { execute: async () => [dto("a"), dto("b"), dto("c")] } as never });
  container.register(AddQuizUseCase, { useValue: { execute } as never });
  container.register(UpdateQuizUseCase, { useValue: { execute } as never });
  container.register(DeleteQuizUseCase, { useValue: { execute } as never });
  container.register(QuizRepository, { useValue: { readRecord: async () => ({ quizzes: [], media: {} }) } as never });
});

afterEach(() => {
  app?.unmount();
  host?.remove();
  document.body.innerHTML = "";
});

describe("QuizList", () => {
  it("ツールバーはメンバーと同じ並び: 追加 / CSVダウンロード / 素材も含める(ZIP) / CSVから取り込む / n件", async () => {
    await mountList();
    const toolbar = document.body.querySelector(".ui-toolbar")!.textContent!.replace(/\s+/g, "");
    expect(toolbar.indexOf("追加")).toBeLessThan(toolbar.indexOf("CSVダウンロード"));
    expect(toolbar.indexOf("CSVダウンロード")).toBeLessThan(toolbar.indexOf("素材も含める(ZIP)"));
    expect(toolbar.indexOf("素材も含める(ZIP)")).toBeLessThan(toolbar.indexOf("CSVから取り込む"));
    expect(toolbar.indexOf("CSVから取り込む")).toBeLessThan(toolbar.indexOf("3件"));
    expect(buttonText()).not.toContain("選択を削除(0)");
  });

  it("行を選ぶと「選択を削除(n)」が出て、確認のあと選んだ id をまとめて1回で消す", async () => {
    await mountList();
    const checks = document.body.querySelectorAll<HTMLInputElement>("tbody input[type=checkbox]");
    checks[0].click();
    await settle();
    checks[2].click();
    await settle();
    expect(buttonText().some((t) => t.includes("選択を削除(2)"))).toBe(true);
    byText("選択を削除(2)").click();
    await settle();
    expect(execute).toHaveBeenCalledExactlyOnceWith({ ids: ["a", "c"] });
    expect(document.body.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(buttonText().some((t) => t.includes("選択を削除"))).toBe(false);
  });

  it("「CSVから取り込む」で取込ダイアログが開き、置き換えのチェックと素材フォルダの欄がある", async () => {
    await mountList();
    byText("CSVから取り込む").click();
    await settle();
    expect(document.body.querySelector('[data-testid="table-import-table"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="table-import-media"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="table-import-replace"]')).not.toBeNull();
  });
});
