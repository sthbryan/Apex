import { beforeEach, describe, expect, it } from "vitest";
import { Layout } from "@/app/layout/Layout";
import { toolsOff } from "@/features/settings/toolGroups";
import { t } from "@/shared/i18n";
import { render } from "@/test/render";

function globes(container: HTMLElement): number {
  return Array.from(container.querySelectorAll("button")).filter(
    (button) => button.getAttribute("title") === t("browser.open"),
  ).length;
}

beforeEach(() => {
  toolsOff.value = [];
});

describe("the browser button", () => {
  it("is there while the agents can read the browser", () => {
    const { container } = render(<Layout onNewSession={() => {}} />);
    expect(globes(container)).toBe(1);
  });

  it("goes away with the browser tools", () => {
    toolsOff.value = ["browser"];
    const { container } = render(<Layout onNewSession={() => {}} />);
    expect(globes(container)).toBe(0);
  });
});
