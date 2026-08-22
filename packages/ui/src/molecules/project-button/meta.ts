import type { ComponentMeta } from "@/lib/meta";
import { ProjectButton } from "@/molecules/project-button/ProjectButton";

export const projectButtonMeta: ComponentMeta = {
  name: "ProjectButton",
  component: ProjectButton,
  layer: "molecule",
  description: "The project you are in, and the way to switch to another.",
  rule: "Name over path. The alert dot means another project needs you, not this one.",
  variants: [
    { name: "project", props: { name: "apex-sandbox", path: "~/Documents/Codes/apex-sandbox" } },
    {
      name: "waiting elsewhere",
      props: {
        name: "apex-sandbox",
        path: "~/Documents/Codes/apex-sandbox",
        alert: "1 session waiting in another project",
      },
    },
    { name: "no path", props: { name: "apex-docs" } },
  ],
};
