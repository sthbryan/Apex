import { act } from "preact/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { Aside } from "@/app/layout/Aside";
import { asideOpen, asidePanel, openAside } from "@/app/layout/state";
import { toolsOff } from "@/features/settings/toolGroups";
import { t } from "@/shared/i18n";
import { render } from "@/test/render";

vi.mock("@/features/api/ApiPanel", () => ({ ApiPanel: () => null }));
vi.mock("@/features/browser/BrowserView", () => ({ BrowserView: () => null }));

beforeEach(() => {
  toolsOff.value = [];
  asideOpen.value = false;
});

it("switches tools without closing the adjacent panel", () => {
  openAside("api");
  const { container } = render(<Aside />);
  const buttons = Array.from(container.querySelectorAll("button"));
  act(() => buttons.find((button) => button.textContent === t("browser.title"))?.click());
  expect(asidePanel.value).toBe("browser");
  expect(asideOpen.value).toBe(true);
  act(() => buttons.find((button) => button.title === t("aside.close"))?.click());
  expect(asideOpen.value).toBe(false);
});

it("does not offer disabled tools", () => {
  toolsOff.value = ["browser"];
  openAside("api");
  const { container } = render(<Aside />);
  expect(container.querySelectorAll(".apex-aside-tabs button")).toHaveLength(2);
  expect(container.textContent).not.toContain(t("browser.title"));
});
