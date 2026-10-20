import { describe, expect, it } from "vitest";
import { errorResponse } from "@octopus/infrastructures/interfaces";
import { HUB_ERROR_CODES, parseHubErrorCode, stripHubErrorCode } from "../../../shared/hub-error";
import { hubError } from "../hub-error";

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

  it("stripHubErrorCode: 利用者に見せる文言から先頭の [CODE] だけを外す", () => {
    expect(stripHubErrorCode(hubError("ROUND_CLOSED", "受付は終了しました").message)).toBe("受付は終了しました");
    expect(stripHubErrorCode("[UNKNOWN_CODE] x")).toBe("x");
    expect(stripHubErrorCode("通信できません [近くの] 例")).toBe("通信できません [近くの] 例");
    expect(stripHubErrorCode("")).toBe("");
  });
});
