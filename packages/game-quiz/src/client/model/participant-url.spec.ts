import { describe, it, expect } from "vitest";
import { buildParticipantJoinUrl } from "./participant-url";

describe("buildParticipantJoinUrl", () => {
  it("builds a hash-route URL under the current deployment path", () => {
    const url = buildParticipantJoinUrl("q1", {
      origin: "https://script.google.com",
      pathname: "/macros/s/abc/exec",
    });
    expect(url).toBe("https://script.google.com/macros/s/abc/exec#/quiz/q1/join");
  });

  it("encodes special characters in the quiz id", () => {
    const url = buildParticipantJoinUrl("q 1/2", {
      origin: "https://example.com",
      pathname: "/",
    });
    expect(url).toBe("https://example.com/#/quiz/q%201%2F2/join");
  });
});
