import { describe, expect, it } from "vitest";
import { errorResponse } from "@octopus/infrastructures/interfaces";
import { HUB_ERROR_CODES, hubError, parseHubErrorCode } from "../hub-error";

describe("hubError", () => {
  it("コード付きメッセージで、再試行されない応答になる", () => {
    const res = JSON.parse(errorResponse(hubError("SESSION_CLOSED", "終了しました")));
    expect(res).toEqual({ status: "error", message: "[SESSION_CLOSED] 終了しました", retryable: false });
  });

  it.each(HUB_ERROR_CODES)("%s を parse で取り出せる", (code) => {
    expect(parseHubErrorCode(hubError(code, "x").message)).toBe(code);
  });

  it("コードが無い・未知のメッセージは null", () => {
    expect(parseHubErrorCode("Unauthorized")).toBeNull();
    expect(parseHubErrorCode("[UNKNOWN_CODE] x")).toBeNull();
    expect(parseHubErrorCode("")).toBeNull();
  });
});
