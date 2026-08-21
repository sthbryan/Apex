import type { ComponentMeta } from "@/lib/meta";
import { Terminal } from "@/organisms/terminal/Terminal";

export const terminalMeta: ComponentMeta = {
  name: "Terminal",
  layer: "organism",
  description: "Terminal output surface on the dedicated tty tokens.",
  component: Terminal,
  variants: [
    { name: "output", props: { class: "w-56 h-20 rounded-md" }, children: "● tests\n\n⏺ +18 −4" },
    { name: "with cursor", props: { cursor: true, class: "w-56 h-20 rounded-md" }, children: "❯ " },
  ],
};
