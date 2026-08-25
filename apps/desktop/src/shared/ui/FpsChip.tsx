import { framerate, perfStatsEnabled, slowestFrame } from "@/shared/perfStats";

export function FpsChip() {
  if (!perfStatsEnabled.value) {
    return null;
  }
  return (
    <span class="font-mono text-2xs text-faint tabular-nums" title="frames per second, worst frame">
      {framerate.value} fps
      <span class="ml-1 text-faint/70">{slowestFrame.value} low</span>
    </span>
  );
}
