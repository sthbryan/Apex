import type { ComponentChildren } from "preact";
import { useMemo } from "preact/hooks";

import { activeProject } from "@/features/projects/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { requestSession } from "@/features/sessions/pending";
import { sessions } from "@/features/sessions/state";
import { PaneTree } from "@/features/workspace/PaneTree";
import { activeTabId, tabs } from "@/features/workspace/state";
import { TabBar } from "@/features/workspace/TabBar";
import { installedAgents } from "@/shared/daemon";
import { t } from "@/shared/i18n";

const OFFERED_AGENTS = 4;

export function Workspace() {
  return (
    <>
      <TabBar tabs={tabs.value} sessions={sessions.value} />

      <div class="relative min-h-0 flex-1 m-px">
        {tabs.value.length === 0 ? (
          activeProject.value ? (
            <EmptySessions />
          ) : (
            <NoProject />
          )
        ) : (
          tabs.value.map((tab) => {
            const active = tab.id === activeTabId.value;
            return (
              <div
                key={tab.id}
                class="absolute inset-0"
                style={{ visibility: active ? "visible" : "hidden", zIndex: active ? 1 : 0 }}
              >
                <PaneTree
                  tabId={tab.id}
                  node={tab.root}
                  activeLeafId={tab.activeLeafId}
                  tabActive={active}
                />
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function NoProject() {
  return (
    <Splash>
      <p class="text-pretty text-muted">{t("projects.empty")}</p>
    </Splash>
  );
}

function EmptySessions() {
  const project = activeProject.value;
  const installed = installedAgents.value;
  const offered = useMemo(() => sample(installed, OFFERED_AGENTS), [installed]);

  return (
    <Splash>
      <p class="max-w-md text-balance text-muted">{t("workspace.emptyTitle")}</p>
      {project && offered.length > 0 && (
        <ul class="flex flex-wrap items-center justify-center gap-2">
          {offered.map((agent) => (
            <li key={agent.name}>
              <button
                type="button"
                onClick={() =>
                  requestSession({
                    project: project.id,
                    agent: agent.name,
                    direction: null,
                    isGit: project.is_git,
                  })
                }
                class="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-muted transition-colors hover:border-muted hover:text-text"
              >
                <AgentIcon agent={agent.name} size={13} class="shrink-0" />
                {agent.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="text-micro text-faint">
        {t("workspace.emptyHintBefore")} <Kbd>⌘K</Kbd> {t("workspace.emptyHintAfter")}
      </p>
    </Splash>
  );
}

function sample<T>(pool: readonly T[], count: number): T[] {
  const drawn = [...pool];
  for (let index = drawn.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [drawn[index], drawn[swap]] = [drawn[swap], drawn[index]];
  }
  return drawn.slice(0, count);
}

function Splash({ children }: { children: ComponentChildren }) {
  return (
    <div class="relative flex h-full flex-col items-center justify-center gap-5 overflow-hidden bg-pane px-8 text-center">
      <ApexMark />
      <h1 class="relative font-display text-[clamp(3rem,12vw,7rem)] leading-none font-normal tracking-tight text-text">
        APEX
      </h1>
      {children}
    </div>
  );
}

function ApexMark() {
  return (
    <svg
      viewBox="0 0 1024 1024"
      class="pointer-events-none absolute w-[min(70vh,70vw)] text-accent opacity-[0.06]"
      aria-hidden="true"
    >
      <path
        d="M 512 230.4 L 793.6 512 L 512 793.6 L 230.4 512 Z"
        fill="none"
        stroke="currentColor"
        stroke-width="76.8"
        stroke-linejoin="miter"
      />
      <path d="M 512 433.152 L 590.848 512 L 512 590.848 L 433.152 512 Z" fill="currentColor" />
    </svg>
  );
}

function Kbd({ children }: { children: ComponentChildren }) {
  return (
    <kbd class="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-raised px-1.5 font-mono text-micro font-medium leading-none text-text">
      {children}
    </kbd>
  );
}
