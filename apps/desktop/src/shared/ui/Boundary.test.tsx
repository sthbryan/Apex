import { render } from "@testing-library/preact";
import { h } from "preact";
import { describe, expect, it } from "vitest";
import { Boundary } from "./Boundary";

describe("Boundary", () => {
  it("renders children", () => {
    const { container } = render(
      <Boundary>
        <div data-testid="child">ok</div>
      </Boundary>,
    );
    expect(container.textContent).toContain("ok");
  });

  it("derives failure from an error", () => {
    expect(Boundary.getDerivedStateFromError(new Error("boom"))).toEqual({ failure: "boom" });
    expect(Boundary.getDerivedStateFromError("plain")).toEqual({ failure: "plain" });
  });

  it("shows fallback when crashed", () => {
    const boundary = new Boundary({ children: h("div", null, "child") });
    boundary.state = { failure: "oops" };
    const out = boundary.render();
    expect(out).not.toBeNull();
  });
});
