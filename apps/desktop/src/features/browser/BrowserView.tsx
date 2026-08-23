import { BrowserLog, Button, BrowserView as KitBrowserView, type LogLevel } from "@apex/ui";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "preact/hooks";

import { openWeb, overlays } from "@/features/browser/state";
import { activeProjectId } from "@/features/projects/state";
import { onAskPage, onAskShot } from "@/features/sessions/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  id: string;
  url: string;
  name?: string;
  visible: boolean;
  focused: boolean;
};

type Entry = {
  level: string;
  text: string;
  at: number;
};

type Snapshot = {
  url: string;
  title: string | null;
  text: string | null;
  logs: Entry[];
  seq: number;
  failures: number;
};

function report(pane: string, url: string, name?: string): void {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  void invoke("browser_report", { project, pane, url, name: name ?? null }).catch(complain);
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

export function BrowserView({ id, url, name, visible, focused }: Props) {
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
      void invoke("browser_forget", { pane: label }).catch(complain);
    };
  }, [label, url]);

  useEffect(() => {
    report(label, here, name);
  }, [label, here, name]);

  useEffect(() => {
    if (focused) {
      report(label, here, name);
    }
  }, [label, here, name, focused]);

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
  const [failures, setFailures] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const cursor = useRef(0);
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
  }, [label, name]);

  useEffect(() => {
    return onAskShot((event) => {
      if (event.pane !== label) {
        return;
      }
      void invoke<string>("browser_shot", { label })
        .then((path) => invoke("shot_done", { request: event.request, path, error: null }))
        .catch((cause) =>
          invoke("shot_done", { request: event.request, path: null, error: String(cause) }),
        )
        .catch(complain);
    });
  }, [label]);

  useEffect(() => {
    return onAskPage((event) => {
      if (event.pane !== label) {
        return;
      }
      void invoke<string>("browser_probe", { label, since: 0, text: event.text })
        .then((page) => invoke("page_done", { request: event.request, page, error: null }))
        .catch((cause) =>
          invoke("page_done", { request: event.request, page: null, error: String(cause) }),
        )
        .catch(complain);
    });
  }, [label]);

  useEffect(() => {
    if (!shown) {
      return;
    }
    const read = () => {
      void invoke<string>("browser_probe", { label, since: cursor.current, text: false })
        .then((raw) => {
          const taken = raw ? (JSON.parse(raw) as Snapshot | null) : null;
          if (!taken) {
            return;
          }
          cursor.current = taken.seq;
          setFailures(taken.failures);
          if (taken.logs.length > 0) {
            setLogs((current) => [...current, ...taken.logs].slice(-500));
          }
        })
        .catch(() => {});
    };
    read();
    const timer = setInterval(read, drawer ? 1500 : 5000);
    return () => clearInterval(timer);
  }, [label, shown, drawer]);

  const run = (script: string) => {
    void invoke("browser_run", { label, script }).catch(complain);
  };

  return (
    <KitBrowserView
      class="h-full w-full"
      url={draft}
      consoleOpen={drawer}
      consoleTitle={t("browser.console")}
      nav={
        <>
          <Step icon="chevronLeft" hint={t("browser.back")} onPick={() => run("history.back()")} />
          <Step
            icon="chevronRight"
            hint={t("browser.forward")}
            onPick={() => run("history.forward()")}
          />
          <Step icon="refresh" hint={t("browser.reload")} onPick={() => run("location.reload()")} />
        </>
      }
      onUrlInput={(event) => setDraft(event.currentTarget.value)}
      urlProps={{
        onFocus: () => {
          editing.current = true;
        },
        onBlur: () => {
          editing.current = false;
          setDraft(here);
        },
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
            openWeb(draft);
          }
          if (event.key === "Escape") {
            event.currentTarget.blur();
          }
        },
      }}
      actions={
        <>
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
            aria-pressed={drawer}
            onClick={() => setDrawer((open) => !open)}
            class="flex h-5 shrink-0 items-center gap-1 rounded px-1 text-faint transition-colors hover:bg-raised hover:text-text aria-pressed:text-text"
          >
            <Icon name="braces" size={12} />
            {failures > 0 && <span class="text-state-failed">{failures}</span>}
          </button>
        </>
      }
      consoleActions={
        <Button size="xs" variant="subtle" onClick={() => setLogs([])}>
          {t("browser.clear")}
        </Button>
      }
      console={
        <>
          {logs.length === 0 && <BrowserLog>{t("browser.quiet")}</BrowserLog>}
          {logs.map((entry) => (
            <BrowserLog key={`${entry.at}-${entry.text}`} level={levelOf(entry.level)}>
              {entry.text}
            </BrowserLog>
          ))}
        </>
      }
    >
      <div ref={host} class="size-full" />
    </KitBrowserView>
  );
}

function levelOf(level: string): LogLevel {
  if (level === "error" || level === "warn") {
    return level;
  }
  return "info";
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
