import { signal } from "@preact/signals";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/telemetry", () => ({
  metrics: signal(null),
}));

import { metrics } from "@/shared/telemetry";
import { anyOverPace, hasUsage, tightestUsage, toggleUsagePopover, usageOpen } from "./state";

beforeEach(() => {
  usageOpen.value = false;
  (metrics as unknown as { value: unknown }).value = null;
});

describe("hasUsage", () => {
  it("is false when no metrics", () => {
    expect(hasUsage.value).toBe(false);
  });

  it("is true when windows exist", () => {
    (metrics as unknown as { value: unknown }).value = {
      quotas: [{ windows: [{ used_percent: 10 }] }],
      quota_failures: [],
    };
    expect(hasUsage.value).toBe(true);
  });

  it("is true when failures exist", () => {
    (metrics as unknown as { value: unknown }).value = {
      quotas: [],
      quota_failures: ["err"],
    };
    expect(hasUsage.value).toBe(true);
  });
});

describe("tightestUsage", () => {
  it("returns the max used percent", () => {
    (metrics as unknown as { value: unknown }).value = {
      quotas: [{ windows: [{ used_percent: 20 }, { used_percent: 80 }] }],
    };
    expect(tightestUsage.value).toBe(80);
  });

  it("returns null when no windows", () => {
    (metrics as unknown as { value: unknown }).value = { quotas: [] };
    expect(tightestUsage.value).toBeNull();
  });
});

describe("anyOverPace", () => {
  it("detects over pace", () => {
    (metrics as unknown as { value: unknown }).value = {
      quotas: [{ windows: [{ lasts_to_reset: false }] }],
    };
    expect(anyOverPace.value).toBe(true);
    (metrics as unknown as { value: unknown }).value = {
      quotas: [{ windows: [{ lasts_to_reset: true }] }],
    };
    expect(anyOverPace.value).toBe(false);
  });
});

describe("toggleUsagePopover", () => {
  it("toggles the flag", () => {
    toggleUsagePopover();
    expect(usageOpen.value).toBe(true);
    toggleUsagePopover();
    expect(usageOpen.value).toBe(false);
  });
});
