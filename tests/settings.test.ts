import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, parseSettings } from "@/lib/settings";

describe("parseSettings", () => {
  it("returns defaults for an empty store", () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it("applies stored values over defaults", () => {
    const settings = parseSettings([
      { key: "summaryModel", value: JSON.stringify("gpt-5.4-nano") },
      { key: "autoProcessOnUpload", value: JSON.stringify(false) },
    ]);
    expect(settings.summaryModel).toBe("gpt-5.4-nano");
    expect(settings.autoProcessOnUpload).toBe(false);
    expect(settings.mediaRetention).toBe(DEFAULT_SETTINGS.mediaRetention);
  });

  it("drops unknown keys, invalid values, and unparseable JSON", () => {
    const settings = parseSettings([
      { key: "hacked", value: JSON.stringify("value") },
      { key: "summaryModel", value: JSON.stringify("not-a-model") },
      { key: "theme", value: "{{{not json" },
    ]);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});
