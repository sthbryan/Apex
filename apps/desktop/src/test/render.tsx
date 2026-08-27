import type { ComponentChild } from "preact";
import { render as paint } from "preact";
import { act } from "preact/test-utils";
import { afterEach } from "vitest";

const mounted: HTMLElement[] = [];

export function render(node: ComponentChild): {
  container: HTMLElement;
  rerender: (next: ComponentChild) => void;
} {
  const container = document.createElement("div");
  document.body.append(container);
  mounted.push(container);
  act(() => {
    paint(node, container);
  });
  return {
    container,
    rerender: (next) => {
      act(() => {
        paint(next, container);
      });
    },
  };
}

afterEach(() => {
  for (const container of mounted.splice(0)) {
    act(() => {
      paint(null, container);
    });
    container.remove();
  }
});
