import { describe, it, expect } from "vitest";
import { buildParticipantJoinUrl, buildParticipantJoinUrlFromBase } from "./participant-url";

describe("buildParticipantJoinUrlFromBase", () => {
  it("uses the public web app URL instead of the GAS sandbox iframe URL", () => {
    const url = buildParticipantJoinUrlFromBase("q1", "", "https://script.google.com/macros/s/abc/exec");
    expect(url).toBe("https://script.google.com/macros/s/abc/exec#/quiz/q1/join");
  });

  it("drops any existing hash from the base URL", () => {
    const url = buildParticipantJoinUrlFromBase("q1", "", "https://example.com/app#/home");
    expect(url).toBe("https://example.com/app#/quiz/q1/join");
  });

  it("falls back to window.location when no base URL is available", () => {
    expect(buildParticipantJoinUrlFromBase("q1", "", null)).toBe(buildParticipantJoinUrl("q1", ""));
  });
});

describe("buildParticipantJoinUrl", () => {
  it("builds a hash-route URL under the current deployment path", () => {
    const url = buildParticipantJoinUrl("q1", "", {
      origin: "https://script.google.com",
      pathname: "/macros/s/abc/exec",
    });
    expect(url).toBe("https://script.google.com/macros/s/abc/exec#/quiz/q1/join");
  });

  it("encodes special characters in the quiz id", () => {
    const url = buildParticipantJoinUrl("q 1/2", "", {
      origin: "https://example.com",
      pathname: "/",
    });
    expect(url).toBe("https://example.com/#/quiz/q%201%2F2/join");
  });
});

describe("join url query", () => {
  it("appends the session query to the hash route", () => {
    const url = buildParticipantJoinUrl("q1", "?demo=1", { origin: "https://example.com", pathname: "/app" });
    expect(url).toBe("https://example.com/app#/quiz/q1/join?demo=1");
  });
});
