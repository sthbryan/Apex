import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { GitTarget } from "@/bindings/GitTarget";
import type { ImagePair } from "@/bindings/ImagePair";
import { readImages } from "@/features/git/state";
import { t } from "@/shared/i18n";

type Found = {
  path: string;
  pair: ImagePair;
};

type Props = {
  target: GitTarget;
  paths: string[];
  commit: string | null;
  named: boolean;
  children: ComponentChildren;
};

export function ImageDiff({ target, paths, commit, named, children }: Props) {
  const [found, setFound] = useState<Found[] | null>(null);
  const key = paths.join("\n");

  useEffect(() => {
    let alive = true;
    void Promise.all(
      key.split("\n").map(async (path) => ({ path, pair: await readImages(target, path, commit) })),
    )
      .then((pairs) => {
        if (alive) {
          setFound(pairs.filter((entry) => entry.pair.before || entry.pair.after));
        }
      })
      .catch(() => {
        if (alive) {
          setFound([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [target, key, commit]);

  if (found === null || found.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      {found.map((entry) => (
        <div key={entry.path}>
          {named && (
            <h3 class="truncate border-b border-border bg-surface px-3 py-1 text-faint">
              {entry.path}
            </h3>
          )}
          <div class="grid animate-fade-in grid-cols-2 gap-px bg-border">
            <Frame
              label={t("git.imageBefore")}
              source={entry.pair.before}
              tone="text-git-removed"
            />
            <Frame label={t("git.imageAfter")} source={entry.pair.after} tone="text-git-added" />
          </div>
        </div>
      ))}
    </>
  );
}

function Frame({ label, source, tone }: { label: string; source: string | null; tone: string }) {
  return (
    <figure class="flex min-h-0 flex-col bg-bg">
      <figcaption
        class={`border-b border-border px-3 py-1 text-xs uppercase tracking-wider ${tone}`}
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
