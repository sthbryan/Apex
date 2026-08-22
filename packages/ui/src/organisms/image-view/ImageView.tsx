import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type ImageFit = "contain" | "actual";

export interface ImageViewProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  src: string;
  alt: string;
  fit?: ImageFit;
  meta?: ComponentChildren;
  actions?: ComponentChildren;
}

export function ImageView({ src, alt, fit = "contain", meta, actions, class: className, ...rest }: ImageViewProps) {
  return (
    <div class={cn("ui-image-view", className as string)} data-fit={fit} {...rest}>
      <div class="ui-image-stage">
        <img src={src} alt={alt} />
      </div>
      {meta || actions ? (
        <div class="ui-image-foot">
          {meta}
          {actions ? <span class="ml-auto flex items-center gap-2">{actions}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
