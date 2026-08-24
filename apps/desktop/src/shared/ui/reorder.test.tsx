import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";
import { useReorder } from "@/shared/ui/reorder";
import { render } from "@/test/render";

const ROW = 20;

function List({ settle }: { settle: (id: string, seat: number) => void }) {
  const { held, seat, grab } = useReorder(settle);
  return (
    <ul data-reorder data-held={held ?? ""} data-seat-now={seat ?? ""}>
      {["a", "b", "c", "d"].map((id, index) => (
        <li key={id} data-seat data-id={id} onMouseDown={(event) => grab(id, index, event)}>
          {id}
        </li>
      ))}
    </ul>
  );
}

function measured(container: HTMLElement): HTMLElement[] {
  const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-seat]"));
  rows.forEach((row, index) => {
    row.getBoundingClientRect = () =>
      ({ top: index * ROW, height: ROW, bottom: index * ROW + ROW }) as DOMRect;
  });
  return rows;
}

function press(row: HTMLElement, y: number): void {
  act(() => {
    row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientY: y }));
  });
}

function move(y: number): void {
  act(() => {
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientY: y }));
  });
}

function release(): void {
  act(() => {
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

describe("useReorder", () => {
  it("lands an item in the half of the row it was dropped on", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[0], 10);
    move(55);
    release();

    expect(settle).toHaveBeenCalledWith("a", 2);
  });

  it("counts seats from below when dragging upward", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[3], 70);
    move(25);
    release();

    expect(settle).toHaveBeenCalledWith("d", 1);
  });

  it("drops past the last row at the end", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[0], 10);
    move(200);
    release();

    expect(settle).toHaveBeenCalledWith("a", 3);
  });

  it("treats a twitch as a click, not a drag", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[0], 10);
    move(12);
    release();

    expect(settle).not.toHaveBeenCalled();
  });

  it("stays quiet when the item lands where it started", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[0], 10);
    move(60);
    move(5);
    release();

    expect(settle).not.toHaveBeenCalled();
  });

  it("marks the held row and the seat while dragging", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);
    const list = container.querySelector<HTMLElement>("[data-reorder]");

    press(rows[0], 10);
    move(55);

    expect(list?.dataset.held).toBe("a");
    expect(list?.dataset.seatNow).toBe("2");

    release();

    expect(list?.dataset.held).toBe("");
    expect(list?.dataset.seatNow).toBe("");
  });

  it("blocks text selection from the first pixel of a press", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[0], 10);

    expect(document.body.style.userSelect).toBe("none");

    release();

    expect(document.body.style.userSelect).toBe("");
  });

  it("swallows the click that ends a drag", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[0], 10);
    move(55);
    release();

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    rows[0].dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it("lets a plain click through", () => {
    const settle = vi.fn();
    const { container } = render(<List settle={settle} />);
    const rows = measured(container);

    press(rows[0], 10);
    release();

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    rows[0].dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
  });
});
