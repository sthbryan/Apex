import type { ComponentMeta } from "@/lib/meta";
import { ToggleChip } from "@/molecules/toggle-chip/ToggleChip";

export const toggleChipMeta: ComponentMeta = {
  name: "ToggleChip",
  layer: "molecule",
  description: "Multi-select chip for picking agents and filters.",
  component: ToggleChip,
  variants: [
    { name: "off", props: { pressed: false }, children: "codex" },
    { name: "on", props: { pressed: true }, children: "claude" },
    { name: "sm", props: { pressed: true, size: "sm" }, children: "claude" },
    { name: "disabled", props: { pressed: false, disabled: true }, children: "gemini" },
  ],
};
