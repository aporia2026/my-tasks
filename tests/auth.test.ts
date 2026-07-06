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
  it("round-trips the user id and role", async () => {
    const token = await createSessionToken(SECRET, {
      sub: "user-1",
      role: "admin",
    });
    const session = await verifySessionToken(SECRET, token);
    expect(session?.sub).toBe("user-1");
    expect(session?.role).toBe("admin");
  });

  it("carries the requester role", async () => {
    const token = await createSessionToken(SECRET, {
      sub: "user-2",
      role: "requester",
    });
    expect((await verifySessionToken(SECRET, token))?.role).toBe("requester");
  });

  it("rejects missing, malformed, and tampered tokens", async () => {
    expect(await verifySessionToken(SECRET, undefined)).toBeNull();
    expect(await verifySessionToken(SECRET, "")).toBeNull();
    expect(await verifySessionToken(SECRET, "no-dot")).toBeNull();
    expect(await verifySessionToken(SECRET, ".sigonly")).toBeNull();

    const token = await createSessionToken(SECRET, { sub: "u", role: "admin" });
    const [payload, signature] = token.split(".");
    // A signature that no longer matches the payload.
    expect(
      await verifySessionToken(SECRET, `${payload}.AAAA${signature}`),
    ).toBeNull();
    // A payload swapped under a signature that was minted for a different one.
    const other = await createSessionToken(SECRET, {
      sub: "z",
      role: "requester",
    });
    const otherPayload = other.split(".")[0];
    expect(
      await verifySessionToken(SECRET, `${otherPayload}.${signature}`),
    ).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await createSessionToken("other-secret", {
      sub: "u",
      role: "admin",
    });
    expect(await verifySessionToken(SECRET, token)).toBeNull();
  });

  it("honors expiry", async () => {
    const now = 1_000_000;
    const token = await createSessionToken(SECRET, { sub: "u", role: "admin" }, now);
    expect(
      await verifySessionToken(SECRET, token, now + SESSION_TTL_MS - 1),
    ).not.toBeNull();
    expect(
      await verifySessionToken(SECRET, token, now + SESSION_TTL_MS),
    ).toBeNull();
  });
});

describe("safeEqual", () => {
  it("matches equal strings and rejects different ones", async () => {
    expect(await safeEqual("secret", "secret")).toBe(true);
    expect(await safeEqual("secret", "secreT")).toBe(false);
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
