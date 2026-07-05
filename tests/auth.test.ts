import { beforeEach, describe, expect, it } from "vitest";

import {
  SESSION_TTL_MS,
  createSessionToken,
  registerLoginAttempt,
  resetLoginAttempts,
  safeEqual,
  verifySessionToken,
} from "@/lib/auth";

const SECRET = "test-secret-long-enough-for-hmac";

describe("session tokens", () => {
  it("round-trips a valid token", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(SECRET, token)).toBe(true);
  });

  it("rejects missing, malformed, and tampered tokens", async () => {
    expect(await verifySessionToken(SECRET, undefined)).toBe(false);
    expect(await verifySessionToken(SECRET, "")).toBe(false);
    expect(await verifySessionToken(SECRET, "no-dot")).toBe(false);
    expect(await verifySessionToken(SECRET, ".sigonly")).toBe(false);

    const token = await createSessionToken(SECRET);
    const [expires, signature] = token.split(".");
    expect(
      await verifySessionToken(SECRET, `${Number(expires) + 1000}.${signature}`),
    ).toBe(false);
    expect(await verifySessionToken(SECRET, `${expires}.AAAA${signature}`)).toBe(
      false,
    );
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await createSessionToken("other-secret");
    expect(await verifySessionToken(SECRET, token)).toBe(false);
  });

  it("honors expiry", async () => {
    const now = Date.now();
    const token = await createSessionToken(SECRET, now);
    expect(await verifySessionToken(SECRET, token, now + SESSION_TTL_MS - 1)).toBe(
      true,
    );
    expect(await verifySessionToken(SECRET, token, now + SESSION_TTL_MS)).toBe(
      false,
    );
  });
});

describe("safeEqual", () => {
  it("matches equal strings and rejects different ones", async () => {
    expect(await safeEqual("passcode", "passcode")).toBe(true);
    expect(await safeEqual("passcode", "passcodE")).toBe(false);
    expect(await safeEqual("short", "much-longer-value")).toBe(false);
    expect(await safeEqual("", "")).toBe(true);
  });

  it("handles unicode", async () => {
    expect(await safeEqual("סיסמה", "סיסמה")).toBe(true);
    expect(await safeEqual("סיסמה", "סיסמא")).toBe(false);
  });
});

describe("login throttle", () => {
  beforeEach(() => resetLoginAttempts());

  it("allows up to the limit inside the window, then blocks", () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      expect(registerLoginAttempt(now + i)).toBe(true);
    }
    expect(registerLoginAttempt(now + 11)).toBe(false);
  });

  it("frees up after the window passes", () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) registerLoginAttempt(now);
    expect(registerLoginAttempt(now + 1000 * 60 * 10 + 1)).toBe(true);
  });
});
