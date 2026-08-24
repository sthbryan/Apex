import { act } from "preact/test-utils";
import { describe, expect, it } from "vitest";
import { ContextMenu, closeMenu, editable, openMenu } from "@/shared/ui/ContextMenu";
import { render } from "@/test/render";

function fire(target: Element): MouseEvent {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("editable", () => {
  it("spots the fields where the native menu still belongs", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<input id="a"><textarea id="b"></textarea><div contenteditable="true"><b id="c">x</b></div><span id="d">x</span>';
    document.body.append(host);

    expect(editable(host.querySelector("#a"))).toBe(true);
    expect(editable(host.querySelector("#b"))).toBe(true);
    expect(editable(host.querySelector("#c"))).toBe(true);
    expect(editable(host.querySelector("#d"))).toBe(false);
    expect(editable(null)).toBe(false);

    host.remove();
  });
});

describe("ContextMenu", () => {
  it("swallows the native menu everywhere but a text field", () => {
    render(<ContextMenu />);
    const plain = document.createElement("div");
    const field = document.createElement("input");
    document.body.append(plain, field);

    expect(fire(plain).defaultPrevented).toBe(true);
    expect(fire(field).defaultPrevented).toBe(false);

    plain.remove();
    field.remove();
  });

  it("opens nothing when a target offers no actions", () => {
    const { container } = render(<ContextMenu />);
    openMenu(new MouseEvent("contextmenu", { cancelable: true }), []);

    expect(container.querySelector(".ui-menu")).toBeNull();
  });
});

describe("the open menu", () => {
  it("floats on the body, above whatever the pane stacks", () => {
    render(<ContextMenu />);
    const target = document.createElement("div");
    document.body.append(target);
    act(() => {
      openMenu(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }), [
        { label: "Close the pane", run: () => {} },
      ]);
    });

    const float = document.body.querySelector(".ui-menu-float");
    expect(float?.parentElement).toBe(document.body);
    expect(float?.querySelector(".ui-menu")?.textContent).toContain("Close the pane");

    closeMenu();
    target.remove();
  });
});
