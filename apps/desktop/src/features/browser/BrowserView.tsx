import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";

import { openWeb, overlays } from "@/features/browser/state";
import { activeProjectId } from "@/features/projects/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  id: string;
  url: string;
  visible: boolean;
};

type Entry = {
  level: string;
  text: string;
  at: number;
};

function report(
  url: string,
  title: string | null,
  logs: Entry[],
  text: string | null = null,
): void {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  void invoke("browser_report", {
    project,
    url,
    title,
    text,
    logs: logs.map((entry) => ({ level: entry.level, text: entry.text })),
  }).catch(() => {});
}

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

  const [logs, setLogs] = useState<Entry[]>([]);
  const [drawer, setDrawer] = useState(false);
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
      void invoke<string>("browser_text", { label })
        .then((text) => report(event.payload.url, event.payload.title, [], JSON.parse(text)))
        .catch(() => {});
    });
    return () => {
      void stop.then((off) => off());
    };
  }, [label]);

  useEffect(() => {
    const tick = () => {
      void invoke<string>("browser_logs", { label })
        .then((raw) => {
          const found = JSON.parse(raw) as Entry[];
          if (found.length === 0) {
            return;
          }
          setLogs((current) => [...current, ...found].slice(-500));
          report(here, null, found);
        })
        .catch(() => {});
    };
    const timer = setInterval(tick, 1500);
    return () => clearInterval(timer);
  }, [label, here]);

  const failures = logs.filter((entry) => entry.level === "error").length;

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
              event.currentTarget.blur();
              openWeb(draft);
            }
            if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          class="min-w-0 flex-1 rounded bg-raised px-2 py-0.5 text-muted outline-none focus:text-text"
        />
        <Step
          icon="external"
          hint={t("browser.external")}
          onPick={() => {
            void invoke("open_url", { url: here }).catch(complain);
          }}
        />
        <button
          type="button"
          title={t("browser.console")}
          onClick={() => setDrawer((open) => !open)}
          class={cn(
            "flex h-5 shrink-0 items-center gap-1 rounded px-1 transition-colors hover:bg-raised",
            drawer ? "text-text" : "text-faint hover:text-text",
          )}
        >
          <Icon name="braces" size={12} />
          {failures > 0 && <span class="text-state-failed">{failures}</span>}
        </button>
      </div>
      <div ref={host} class="min-h-0 flex-1 bg-pane" />
      {drawer && (
        <div class="flex h-40 shrink-0 flex-col border-t border-border bg-pane">
          <div class="flex shrink-0 items-center justify-between px-2 py-0.5 text-faint">
            <span>{t("browser.console")}</span>
            <button
              type="button"
              onClick={() => setLogs([])}
              class="transition-colors hover:text-text"
            >
              {t("browser.clear")}
            </button>
          </div>
          <ul class="min-h-0 flex-1 overflow-auto px-2 pb-1 font-mono">
            {logs.length === 0 && <li class="text-faint">{t("browser.quiet")}</li>}
            {logs.map((entry) => (
              <li
                key={`${entry.at}-${entry.text}`}
                class={cn(
                  "break-words",
                  entry.level === "error"
                    ? "text-state-failed"
                    : entry.level === "warn"
                      ? "text-state-working"
                      : "text-muted",
                )}
              >
                {entry.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Step({
  icon,
  hint,
  onPick,
}: {
  icon: "chevronLeft" | "chevronRight" | "refresh" | "external";
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
