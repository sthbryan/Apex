import { render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-preact", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { h } = await import("preact");
  const Mock = (props: { size?: number; class?: string }) =>
    h("svg", { width: String(props.size), class: props.class, "data-mock": "icon" });
  return Object.fromEntries(Object.keys(actual).map((name) => [name, Mock]));
});

import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders the glyph", () => {
    const { container } = render(<Icon name="settings" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies size and class", () => {
    const { container } = render(<Icon name="close" size={20} class="my-class" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.classList.contains("my-class")).toBe(true);
  });

  it("renders different names without crashing", () => {
    const { container: a } = render(<Icon name="plus" />);
    const { container: b } = render(<Icon name="check" />);
    expect(a.querySelector("svg")).not.toBeNull();
    expect(b.querySelector("svg")).not.toBeNull();
  });
});
