import {
  BrowserLog,
  BrowserUrl,
  Button,
  BrowserView as KitBrowserView,
  type LogLevel,
} from "@apex/ui";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "preact/hooks";

import { openWeb, readWord, type Word } from "@/features/browser/state";
import { activeProjectId } from "@/features/projects/state";
import { onAskPage, onAskShot } from "@/features/sessions/state";
import { PaneControls, PaneLead, PaneTitle } from "@/features/workspace/slots";
import { dragging } from "@/features/workspace/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  id: string;
  url: string;
  name?: string;
};

type Entry = {
  level: string;
  text: string;
  at: number;
  seq: number;
};

function report(pane: string, url: string, name?: string): void {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  void invoke("browser_report", { project, pane, url, name: name ?? null }).catch(complain);
}

function boxOf(node: HTMLElement) {
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export function BrowserView({ id, url, name }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const label = `browser-${id}`;
  const [here, setHere] = useState(url);
  const [draft, setDraft] = useState(url);
  const [logs, setLogs] = useState<Entry[]>([]);
  const [failures, setFailures] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const editing = useRef(false);
  const said = useRef<{ url: string; title: string | null }>({ url, title: null });

  useEffect(() => {
    setHere(url);
    setDraft(url);
    setLogs([]);
    setFailures(0);
    said.current = { url, title: null };
  }, [url]);

  useEffect(() => {
    return () => {
      void invoke("browser_forget", { pane: label }).catch(complain);
    };
  }, [label]);

  useEffect(() => {
    report(label, here, name);
  }, [label, here, name]);

  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) {
        return;
      }
      const word: Word | null = readWord(event.data);
      if (!word) {
        return;
      }
      if (word.kind === "loaded") {
        said.current = { url: word.url, title: word.title };
        setHere(word.url);
        if (!editing.current) {
          setDraft(word.url);
        }
        return;
      }
      if (word.kind === "logs") {
        setFailures(word.failures);
        setLogs((current) => [...current, ...(word.logs as Entry[])].slice(-500));
        return;
      }
      if (word.kind === "leaving") {
        openWeb(word.url);
        return;
      }
      if (word.kind === "page") {
        void invoke("page_done", {
          request: word.request,
          page: JSON.stringify(word.page),
          error: null,
        }).catch(complain);
      }
    };
    window.addEventListener("message", heard);
    return () => window.removeEventListener("message", heard);
  }, []);

  useEffect(() => {
    return onAskPage((event) => {
      if (event.pane !== label) {
        return;
      }
      const window_ = frame.current?.contentWindow;
      if (!window_) {
        void invoke("page_done", {
          request: event.request,
          page: null,
          error: "that pane has no page",
        }).catch(complain);
        return;
      }
      window_.postMessage({ apex: "ask", kind: "read", since: 0, request: event.request }, "*");
    });
  }, [label]);

  useEffect(() => {
    return onAskShot((event) => {
      if (event.pane !== label) {
        return;
      }
      const node = frame.current;
      void invoke<string>("browser_shot", {
        label,
        bounds: node ? boxOf(node) : null,
      })
        .then((path) => invoke("shot_done", { request: event.request, path, error: null }))
        .catch((cause) =>
          invoke("shot_done", { request: event.request, path: null, error: String(cause) }),
        )
        .catch(complain);
    });
  }, [label]);

  const run = (kind: "back" | "forward" | "reload") => {
    frame.current?.contentWindow?.postMessage({ apex: "ask", kind }, "*");
  };

  return (
    <>
      <PaneLead>
        <Step icon="chevronLeft" hint={t("browser.back")} onPick={() => run("back")} />
        <Step icon="chevronRight" hint={t("browser.forward")} onPick={() => run("forward")} />
        <Step icon="refresh" hint={t("browser.reload")} onPick={() => run("reload")} />
      </PaneLead>
      <PaneTitle>
        <BrowserUrl
          url={draft}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onFocus={() => {
            editing.current = true;
          }}
          onBlur={() => {
            editing.current = false;
            setDraft(here);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
              openWeb(draft);
            }
            if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
        />
      </PaneTitle>
      <PaneControls>
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
      </PaneControls>
      <KitBrowserView
        class="h-full w-full"
        consoleOpen={drawer}
        consoleTitle={t("browser.console")}
        consoleActions={
          <Button size="xs" variant="subtle" onClick={() => setLogs([])}>
            {t("browser.clear")}
          </Button>
        }
        console={
          <>
            {logs.length === 0 && <BrowserLog>{t("browser.quiet")}</BrowserLog>}
            {logs.map((entry) => (
              <BrowserLog key={`${entry.seq}-${entry.at}`} level={levelOf(entry.level)}>
                {entry.text}
              </BrowserLog>
            ))}
          </>
        }
      >
        <iframe
          ref={frame}
          title={name ?? here}
          src={url}
          class="size-full border-0 bg-white"
          style={dragging.value ? { pointerEvents: "none" } : undefined}
          sandbox="allow-scripts allow-forms allow-same-origin"
        />
      </KitBrowserView>
    </>
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
