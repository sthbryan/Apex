import type { JSX } from "preact";
import { cn } from "@/lib/cn";

export type ImageFit = "contain" | "actual";

export interface ImageViewProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  src: string;
  alt: string;
  fit?: ImageFit;
  onMeasure?: (width: number, height: number) => void;
}

export function ImageView({ src, alt, fit = "contain", onMeasure, class: className, ...rest }: ImageViewProps) {
  return (
    <div class={cn("ui-image-view", className as string)} data-fit={fit} {...rest}>
      <div class="ui-image-stage">
        <img
          src={src}
          alt={alt}
          onLoad={(event) => {
            const image = event.currentTarget;
            onMeasure?.(image.naturalWidth, image.naturalHeight);
          }}
        />
      </div>
    </div>
  );
}
