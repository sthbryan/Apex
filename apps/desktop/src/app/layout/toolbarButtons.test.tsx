import { beforeEach, describe, expect, it } from "vitest";
import { Layout } from "@/app/layout/Layout";
import { toolsOff } from "@/features/settings/toolGroups";
import { t } from "@/shared/i18n";
import { render } from "@/test/render";

function buttons(container: HTMLElement, label: string): number {
  return Array.from(container.querySelectorAll("button")).filter(
    (button) => button.getAttribute("title") === label,
  ).length;
}

function drawn(): HTMLElement {
  return render(<Layout onNewSession={() => {}} />).container;
}

beforeEach(() => {
  toolsOff.value = [];
});

describe("the aside buttons", () => {
  it("are both there while the agents have their tools", () => {
    const container = drawn();
    expect(buttons(container, t("browser.open"))).toBe(1);
    expect(buttons(container, t("api.open"))).toBe(1);
  });

  it("the globe goes away with the browser tools", () => {
    toolsOff.value = ["browser"];
    const container = drawn();
    expect(buttons(container, t("browser.open"))).toBe(0);
    expect(buttons(container, t("api.open"))).toBe(1);
  });

  it("the api button goes away with the api tools", () => {
    toolsOff.value = ["api"];
    const container = drawn();
    expect(buttons(container, t("browser.open"))).toBe(1);
    expect(buttons(container, t("api.open"))).toBe(0);
  });
});
