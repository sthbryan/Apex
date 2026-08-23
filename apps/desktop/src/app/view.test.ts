import { beforeEach, describe, expect, it } from "vitest";
import { closePage, openSettings, page, settingsSection, toggleSettings } from "./view";

beforeEach(() => {
  page.value = "workspace";
  settingsSection.value = "look";
});

describe("openSettings", () => {
  it("opens settings with a section", () => {
    openSettings("agents");
    expect(page.value).toBe("settings");
    expect(settingsSection.value).toBe("agents");
  });
});

describe("closePage", () => {
  it("returns to workspace", () => {
    openSettings("look");
    closePage();
    expect(page.value).toBe("workspace");
  });
});

describe("toggleSettings", () => {
  it("opens when closed", () => {
    toggleSettings("look");
    expect(page.value).toBe("settings");
  });

  it("closes when same section is open", () => {
    openSettings("look");
    toggleSettings("look");
    expect(page.value).toBe("workspace");
  });

  it("switches section when different", () => {
    openSettings("look");
    toggleSettings("agents");
    expect(page.value).toBe("settings");
    expect(settingsSection.value).toBe("agents");
  });
});
