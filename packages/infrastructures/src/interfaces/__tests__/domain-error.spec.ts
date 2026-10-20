import { describe, expect, it } from "vitest";
import { DomainError, errorResponse, respond } from "../domain-error";

describe("errorResponse", () => {
  it("DomainError は retryable:false を付ける", () => {
    expect(JSON.parse(errorResponse(new DomainError("not accepting")))).toEqual({
      status: "error",
      message: "not accepting",
      retryable: false,
    });
  });

  it("通常の Error は retryable を付けない(一時障害として再試行される)", () => {
    expect(JSON.parse(errorResponse(new Error("timeout")))).toEqual({
      status: "error",
      message: "timeout",
    });
  });

  it("Error 以外が投げられても文字列化して返す", () => {
    expect(JSON.parse(errorResponse("oops"))).toEqual({ status: "error", message: "oops" });
  });
});

describe("respond", () => {
  it("成功は status:success と data にする(同期・非同期どちらの戻り値でも)", async () => {
    expect(JSON.parse(await respond(() => ({ a: 1 })))).toEqual({ status: "success", data: { a: 1 } });
    expect(JSON.parse(await respond(async () => [1, 2]))).toEqual({ status: "success", data: [1, 2] });
  });

  it("戻り値が無ければ data は null", async () => {
    expect(JSON.parse(await respond(async () => undefined))).toEqual({ status: "success", data: null });
  });

  it("投げられたら errorResponse と同じ形(DomainError は再試行不要)", async () => {
    expect(JSON.parse(await respond(() => { throw new DomainError("closed"); }))).toEqual({ status: "error", message: "closed", retryable: false });
    expect(JSON.parse(await respond(async () => { throw new Error("boom"); }))).toEqual({ status: "error", message: "boom" });
  });
});
