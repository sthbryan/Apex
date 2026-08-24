import { Pane } from "@apex/ui";
import { useCallback, useState } from "preact/hooks";
import { describe, expect, it } from "vitest";
import type { PaneHosts } from "@/features/workspace/slots";
import { PaneControls, PaneSlots, PaneSub } from "@/features/workspace/slots";
import { render } from "@/test/render";

function Leaf({ renders }: { renders: { count: number } }) {
  const [hosts, setHosts] = useState<PaneHosts>({
    lead: null,
    title: null,
    sub: null,
    controls: null,
  });
  const holdSub = useCallback((el: HTMLElement | null) => {
    setHosts((current) => ({ ...current, sub: el }));
  }, []);
  const holdControls = useCallback((el: HTMLElement | null) => {
    setHosts((current) => ({ ...current, controls: el }));
  }, []);

  renders.count += 1;

  return (
    <Pane
      title="b.ts"
      sub={
        <>
          src
          <span ref={holdSub} class="contents" />
        </>
      }
      controls={<span ref={holdControls} class="contents" />}
      actions={<button type="button">close</button>}
    >
      <PaneSlots.Provider value={hosts}>
        <PaneSub>2 KB</PaneSub>
        <PaneControls>
          <button type="button">reload</button>
        </PaneControls>
      </PaneSlots.Provider>
    </Pane>
  );
}

describe("pane header slots", () => {
  it("lands a view's metadata and controls in the one pane header", () => {
    const { container } = render(<Leaf renders={{ count: 0 }} />);
    const head = container.querySelector(".ui-pane-head");

    expect(head?.textContent).toContain("2 KB");
    expect(head?.querySelector(".ui-pane-tools")?.textContent).toContain("reload");
    expect(container.querySelector(".ui-pane-body")?.textContent).toBe("");
  });

  it("settles instead of looping when the host is handed back", () => {
    const renders = { count: 0 };
    render(<Leaf renders={renders} />);

    expect(renders.count).toBeLessThan(4);
  });
});
