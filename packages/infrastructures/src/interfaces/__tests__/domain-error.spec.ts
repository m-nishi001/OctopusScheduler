import { describe, expect, it } from "vitest";
import { DomainError, errorResponse } from "../domain-error";

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
