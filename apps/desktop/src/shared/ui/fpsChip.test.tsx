import { afterEach, describe, expect, it } from "vitest";
import { framerate, perfStatsEnabled, slowestFrame } from "@/shared/perfStats";
import { FpsChip } from "@/shared/ui/FpsChip";
import { render } from "@/test/render";

afterEach(() => {
  perfStatsEnabled.value = false;
});

describe("the fps chip", () => {
  it("stays out of the bar until you ask for it", () => {
    const { container } = render(<FpsChip />);

    expect(container.textContent).toBe("");
  });

  it("reads out the rate and the worst frame once it is on", () => {
    perfStatsEnabled.value = true;
    framerate.value = 60;
    slowestFrame.value = 41;

    const { container } = render(<FpsChip />);

    expect(container.textContent).toContain("60 fps");
    expect(container.textContent).toContain("41 low");
  });
});
