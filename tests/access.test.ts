import { describe, expect, it } from "vitest";

import { ownsOrAdmin, type Caller } from "@/lib/db/repo/access";

const admin: Caller = { sub: "admin-id", role: "admin" };
const requester: Caller = { sub: "user-1", role: "requester" };

describe("ownsOrAdmin", () => {
  it("lets an admin act on anyone's rows", () => {
    expect(ownsOrAdmin(admin, "user-1")).toBe(true);
    expect(ownsOrAdmin(admin, "user-2")).toBe(true);
    expect(ownsOrAdmin(admin, admin.sub)).toBe(true);
  });

  it("lets a requester act only on their own rows", () => {
    expect(ownsOrAdmin(requester, "user-1")).toBe(true);
    expect(ownsOrAdmin(requester, "user-2")).toBe(false);
    expect(ownsOrAdmin(requester, "admin-id")).toBe(false);
  });
});
