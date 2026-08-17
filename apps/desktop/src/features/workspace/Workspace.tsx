import type { ComponentChildren } from "preact";

import { activeProject } from "@/features/projects/state";
import { sessions } from "@/features/sessions/state";
import { PaneTree } from "@/features/workspace/PaneTree";
import { activeTabId, tabs } from "@/features/workspace/state";
import { TabBar } from "@/features/workspace/TabBar";
import { t } from "@/shared/i18n";

export function Workspace() {
  return (
    <>
      <TabBar tabs={tabs.value} sessions={sessions.value} />

      <div class="relative min-h-0 flex-1 m-px">
        {tabs.value.length === 0 ? (
          activeProject.value ? <EmptySessions /> : <NoProject />
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
    <div class="flex h-full items-center justify-center px-8 text-center text-faint">
      {t("projects.empty")}
    </div>
  );
}

function EmptySessions() {
  return (
    <div class="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <ApexMark />
      <div class="flex max-w-md flex-col gap-2">
        <h1 class="text-balance text-[22px] font-semibold leading-tight text-text">
          {t("workspace.emptyTitle")}
        </h1>
        <p class="text-pretty text-sm leading-relaxed text-muted">
          {t("workspace.emptySubtitle")}
        </p>
      </div>
      <div class="mt-1 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted">
        <span>{t("workspace.emptyHintBefore")}</span>
        <Kbd>⌘K</Kbd>
        <span>{t("workspace.emptyHintAfter")}</span>
      </div>
    </div>
  );
}

function ApexMark() {
  return (
    <svg
      viewBox="0 0 1024 1024"
      class="size-16 text-accent"
      aria-hidden="true"
    >
      <path
        d="M 512 230.4 L 793.6 512 L 512 793.6 L 230.4 512 Z"
        fill="none"
        stroke="currentColor"
        stroke-width="76.8"
        stroke-linejoin="miter"
      />
      <path
        d="M 512 433.152 L 590.848 512 L 512 590.848 L 433.152 512 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Kbd({ children }: { children: ComponentChildren }) {
  return (
    <kbd class="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-raised px-1.5 font-mono text-[11px] font-medium leading-none text-text">
      {children}
    </kbd>
  );
}
