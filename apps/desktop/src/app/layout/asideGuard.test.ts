import { beforeEach, describe, expect, it } from "vitest";

import { asideOpen, asidePanel, closeAside, openAside } from "@/app/layout/state";
import { toolsOff } from "@/features/settings/toolGroups";
import { startAsideGuard } from "./asideGuard";

beforeEach(() => {
  localStorage.clear();
  toolsOff.value = [];
  closeAside();
  asidePanel.value = "browser";
});

describe("startAsideGuard", () => {
  it("shuts the aside when the panel on show loses its tools", () => {
    openAside("browser");
    const stop = startAsideGuard();
    toolsOff.value = ["browser"];
    expect(asideOpen.value).toBe(false);
    stop();
  });

  it("minds each panel on its own group", () => {
    openAside("api");
    const stop = startAsideGuard();
    toolsOff.value = ["browser"];
    expect(asideOpen.value).toBe(true);
    toolsOff.value = ["browser", "api"];
    expect(asideOpen.value).toBe(false);
    stop();
  });

  it("leaves a shut aside alone", () => {
    const stop = startAsideGuard();
    toolsOff.value = ["browser", "api"];
    expect(asideOpen.value).toBe(false);
    stop();
  });

  it("stops minding once it is torn down", () => {
    const stop = startAsideGuard();
    stop();
    openAside("api");
    toolsOff.value = ["api"];
    expect(asideOpen.value).toBe(true);
  });
});
