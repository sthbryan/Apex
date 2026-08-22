import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";
import { Glyph } from "@/atoms/glyph/Glyph";

export interface ProjectButtonProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  name: string;
  path?: string;
  icon?: ComponentChildren;
  alert?: string;
  trail?: ComponentChildren;
}

export function ProjectButton({
  name, path, icon, alert, trail, class: className, ...rest
}: ProjectButtonProps) {
  return (
    <button type="button" class={cn("ui-project-button", className as string)} {...rest}>
      {icon ? <Glyph>{icon}</Glyph> : null}
      <span class="ui-project-button-text">
        <span class="ui-project-button-name">{name}</span>
        {path ? <span class="ui-project-button-path">{path}</span> : null}
      </span>
      {alert ? <span class="ui-project-button-alert" title={alert} /> : null}
      {trail}
    </button>
  );
}
