import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "preact/hooks";

import { overlays } from "@/features/browser/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  id: string;
  url: string;
  visible: boolean;
};

type Loaded = {
  label: string;
  url: string;
  title: string | null;
};

function boxOf(node: HTMLElement) {
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export function BrowserView({ id, url, visible }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const label = `browser-${id}`;
  const [here, setHere] = useState(url);
  const [draft, setDraft] = useState(url);
  const editing = useRef(false);

  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    void invoke("browser_open", { label, url, bounds: boxOf(node) }).catch(complain);
    return () => {
      void invoke("browser_close", { label }).catch(complain);
    };
  }, [label, url]);

  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    const move = () => {
      void invoke("browser_bounds", { label, bounds: boxOf(node) }).catch(complain);
    };
    const observer = new ResizeObserver(move);
    observer.observe(node);
    window.addEventListener("resize", move);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", move);
    };
  }, [label]);

  const shown = visible && overlays.value === 0;

  useEffect(() => {
    void invoke("browser_show", { label, visible: shown }).catch(complain);
  }, [label, shown]);

  useEffect(() => {
    const stop = listen<Loaded>("browser-loaded", (event) => {
      if (event.payload.label !== label || !event.payload.url) {
        return;
      }
      setHere(event.payload.url);
      if (!editing.current) {
        setDraft(event.payload.url);
      }
    });
    return () => {
      void stop.then((off) => off());
    };
  }, [label]);

  const run = (script: string) => {
    void invoke("browser_run", { label, script }).catch(complain);
  };

  return (
    <div class="flex h-full w-full flex-col">
      <div class="flex shrink-0 items-center gap-1 border-b border-border bg-pane px-1 py-0.5">
        <Step icon="chevronLeft" hint={t("browser.back")} onPick={() => run("history.back()")} />
        <Step
          icon="chevronRight"
          hint={t("browser.forward")}
          onPick={() => run("history.forward()")}
        />
        <Step icon="refresh" hint={t("browser.reload")} onPick={() => run("location.reload()")} />
        <input
          value={draft}
          spellcheck={false}
          onFocus={() => {
            editing.current = true;
          }}
          onBlur={() => {
            editing.current = false;
            setDraft(here);
          }}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const node = host.current;
              event.currentTarget.blur();
              if (node) {
                void invoke("browser_open", { label, url: draft, bounds: boxOf(node) }).catch(
                  complain,
                );
              }
            }
            if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          class="min-w-0 flex-1 rounded bg-raised px-2 py-0.5 text-muted outline-none focus:text-text"
        />
      </div>
      <div ref={host} class="min-h-0 flex-1 bg-pane" />
    </div>
  );
}

function Step({
  icon,
  hint,
  onPick,
}: {
  icon: "chevronLeft" | "chevronRight" | "refresh";
  hint: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onPick}
      class="flex size-5 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
    >
      <Icon name={icon} size={12} />
    </button>
  );
}
