import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { GitTarget } from "@/bindings/GitTarget";
import type { ImagePair } from "@/bindings/ImagePair";
import { readImages } from "@/features/git/state";
import { t } from "@/shared/i18n";

type Props = {
  target: GitTarget;
  path: string;
  commit: string | null;
  heading?: string;
  children: ComponentChildren;
};

export function ImageDiff({ target, path, commit, heading, children }: Props) {
  const [pair, setPair] = useState<ImagePair | null>(null);

  useEffect(() => {
    let alive = true;
    void readImages(target, path, commit)
      .then((found) => {
        if (alive) {
          setPair(found);
        }
      })
      .catch(() => {
        if (alive) {
          setPair(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [target, path, commit]);

  if (!pair || (!pair.before && !pair.after)) {
    return <>{children}</>;
  }

  return (
    <>
      {heading && (
        <h3 class="truncate border-b border-border bg-surface px-3 py-1 text-faint">{heading}</h3>
      )}
      <div class="grid animate-veil-in grid-cols-2 gap-px bg-border">
        <Frame label={t("git.imageBefore")} source={pair.before} tone="text-git-removed" />
        <Frame label={t("git.imageAfter")} source={pair.after} tone="text-git-added" />
      </div>
    </>
  );
}

function Frame({ label, source, tone }: { label: string; source: string | null; tone: string }) {
  return (
    <figure class="flex min-h-0 flex-col bg-pane">
      <figcaption
        class={`border-b border-border px-3 py-1 text-micro uppercase tracking-wider ${tone}`}
      >
        {label}
      </figcaption>
      {source ? (
        <img src={source} alt={label} class="checkers max-h-96 w-full object-contain p-4" />
      ) : (
        <p class="p-4 text-faint">{t("git.imageMissing")}</p>
      )}
    </figure>
  );
}
