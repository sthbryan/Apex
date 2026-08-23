import { Welcome, Wordmark } from "@apex/ui";
import type { ComponentChildren } from "preact";

import { activeProject } from "@/features/projects/state";
import { sessions } from "@/features/sessions/state";
import { Home } from "@/features/workspace/Home";
import { PaneTree } from "@/features/workspace/PaneTree";
import { activeTabId, homeOpen, tabs } from "@/features/workspace/state";
import { TabBar } from "@/features/workspace/TabBar";
import { t } from "@/shared/i18n";

export function Workspace() {
  return (
    <>
      <TabBar tabs={tabs.value} sessions={sessions.value} />

      <div class="relative min-h-0 flex-1 m-px">
        {homeOpen.value || tabs.value.length === 0 ? (
          activeProject.value ? (
            <Home />
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

function Splash({ children }: { children: ComponentChildren }) {
  return (
    <Welcome
      class="relative h-full overflow-hidden"
      mark={
        <>
          <ApexMark />
          <Wordmark size="xl" class="relative">
            APEX
          </Wordmark>
        </>
      }
    >
      {children}
    </Welcome>
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
