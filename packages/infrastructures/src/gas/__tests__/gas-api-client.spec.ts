import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlobRoute } from "../../interfaces/api-client";

const calls: { functionName: string; args: unknown }[] = [];
let reply: unknown = undefined;

vi.mock("@octopus/client-common/google-apps-script/gas-script-service", () => ({
  GasFunctionService: class {
    constructor(private readonly functionName: string) {}
    async call(args: unknown) {
      calls.push({ functionName: this.functionName, args });
      return reply;
    }
  },
}));
// node には FileReader が無いので、データURL化だけ差し替える(base64 にして `data:<種類>;base64,…` を作る)
vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async (blob: Blob) => `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`,
}));

const { GasApiClient } = await import("../gas-api-client");

const route: BlobRoute = { module: "quiz-game", gasPut: "quizGame_putBlob", gasGet: "quizGame_getBlob" };
const HASH = "a".repeat(32);

beforeEach(() => {
  calls.length = 0;
  reply = undefined;
});

describe("GasApiClient のファイル送受信(GAS は文字列しか送れないので base64 のまま)", () => {
  it("putBlob: ファイルを base64 のデータURLにして GAS の関数を呼ぶ", async () => {
    await new GasApiClient().putBlob(route, HASH, new Blob([new Uint8Array([0, 1, 2, 250, 255])], { type: "image/png" }));
    expect(calls).toEqual([{ functionName: "quizGame_putBlob", args: { hash: HASH, dataUrl: "data:image/png;base64,AAEC+v8=" } }]);
  });

  it("getBlob: 返ってきたデータURLを、元のバイト列と種類の Blob に戻す", async () => {
    reply = { dataUrl: "data:image/png;base64,AAEC+v8=" };
    const blob = await new GasApiClient().getBlob(route, HASH);
    expect(calls).toEqual([{ functionName: "quizGame_getBlob", args: { hash: HASH } }]);
    expect(blob!.type).toBe("image/png");
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([0, 1, 2, 250, 255]);
  });

  it("getBlob: サーバーに無ければ null", async () => {
    reply = { dataUrl: null };
    expect(await new GasApiClient().getBlob(route, HASH)).toBeNull();
  });
});
