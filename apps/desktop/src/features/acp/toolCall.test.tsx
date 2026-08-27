import { ToolCall } from "@apex/ui";
import { describe, expect, it } from "vitest";
import { render } from "@/test/render";

function call(open: boolean) {
  const { container } = render(
    <ToolCall command="search apex-agent" name="search" open={open} onToggle={() => {}}>
      <pre>crates/apex-agent/src/chat.rs</pre>
    </ToolCall>,
  );
  return {
    section: container.querySelector<HTMLElement>(".ui-tool-call"),
    fold: container.querySelector<HTMLElement>(".ui-tool-call-fold"),
  };
}

describe("opening a tool call", () => {
  it("holds nothing in the page until it has been opened once", () => {
    expect(call(false).fold).toBeNull();
  });

  it("marks the section so the fold has something to animate to", () => {
    const { section, fold } = call(true);
    expect(fold).not.toBeNull();
    expect(section?.dataset.open).toBe("true");
    expect(fold?.textContent).toContain("crates/apex-agent/src/chat.rs");
  });

  it("keeps the output mounted after a close so it can fold shut", () => {
    const { container, rerender } = render(
      <ToolCall command="search apex-agent" open onToggle={() => {}}>
        <pre>held</pre>
      </ToolCall>,
    );
    rerender(
      <ToolCall command="search apex-agent" open={false} onToggle={() => {}}>
        <pre>held</pre>
      </ToolCall>,
    );

    expect(container.querySelector(".ui-tool-call-fold")).not.toBeNull();
    expect(container.querySelector<HTMLElement>(".ui-tool-call")?.dataset.open).toBeUndefined();
  });
});
