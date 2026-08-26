import {
  BrowserLog,
  BrowserUrl,
  Button,
  BrowserView as KitBrowserView,
  type LogLevel,
  Pane,
} from "@apex/ui";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "preact/hooks";

import { browserUrl, lastUrl, openWeb, readWord, type Word } from "@/features/browser/state";
import { activeProjectId } from "@/features/projects/state";
import { onAskPage, onAskShot } from "@/features/sessions/state";
import { dragging } from "@/features/workspace/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export const BROWSER_PANE = "browser";

type Entry = {
  level: string;
  text: string;
  at: number;
  seq: number;
};

function report(url: string): void {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  void invoke("browser_report", { project, pane: BROWSER_PANE, url }).catch(complain);
}

function boxOf(node: HTMLElement) {
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export function BrowserView() {
  const url = browserUrl.value ?? "";
  const offered = url || lastUrl() || "";
  const frame = useRef<HTMLIFrameElement>(null);
  const [here, setHere] = useState(url);
  const [draft, setDraft] = useState(offered);
  const [logs, setLogs] = useState<Entry[]>([]);
  const [failures, setFailures] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const editing = useRef(false);

  useEffect(() => {
    setHere(url);
    setDraft(url || lastUrl() || "");
    setLogs([]);
    setFailures(0);
  }, [url]);

  useEffect(() => {
    return () => {
      void invoke("browser_forget", { pane: BROWSER_PANE }).catch(complain);
    };
  }, []);

  useEffect(() => {
    report(here);
  }, [here]);

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
      const window_ = frame.current?.contentWindow;
      if (!window_) {
        void invoke("page_done", {
          request: event.request,
          page: null,
          error: "the browser has no page",
        }).catch(complain);
        return;
      }
      window_.postMessage({ apex: "ask", kind: "read", since: 0, request: event.request }, "*");
    });
  }, []);

  useEffect(() => {
    return onAskShot((event) => {
      const node = frame.current;
      void invoke<string>("browser_shot", {
        label: BROWSER_PANE,
        bounds: node ? boxOf(node) : null,
      })
        .then((path) => invoke("shot_done", { request: event.request, path, error: null }))
        .catch((cause) =>
          invoke("shot_done", { request: event.request, path: null, error: String(cause) }),
        )
        .catch(complain);
    });
  }, []);

  const run = (kind: "back" | "forward" | "reload") => {
    frame.current?.contentWindow?.postMessage({ apex: "ask", kind }, "*");
  };

  return (
    <Pane
      wide
      scroll={false}
      class="h-full"
      lead={
        <>
          <Step icon="chevronLeft" hint={t("browser.back")} onPick={() => run("back")} />
          <Step icon="chevronRight" hint={t("browser.forward")} onPick={() => run("forward")} />
          <Step icon="refresh" hint={t("browser.reload")} onPick={() => run("reload")} />
        </>
      }
      title={
        <BrowserUrl
          url={draft}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onFocus={() => {
            editing.current = true;
          }}
          onBlur={() => {
            editing.current = false;
            setDraft(here || lastUrl() || "");
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
      }
      controls={
        <>
          <Step
            icon="external"
            hint={t("browser.external")}
            onPick={() => {
              if (!here) {
                return;
              }
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
    >
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
        {url === "" ? (
          <div class="flex size-full flex-col items-center justify-center gap-1 p-6 text-center">
            <p class="text-muted text-sm">{t("browser.nothing")}</p>
            <p class="text-faint text-xs">{t("browser.nothingHint")}</p>
          </div>
        ) : (
          <iframe
            ref={frame}
            title={here}
            src={url}
            class="size-full border-0 bg-white"
            style={dragging.value ? { pointerEvents: "none" } : undefined}
            sandbox="allow-scripts allow-forms allow-same-origin"
          />
        )}
      </KitBrowserView>
    </Pane>
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
