import { getVersion } from "@tauri-apps/api/app";
import cn from "cnfast";
import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";

import { closePage } from "@/app/view";
import { installedEditors, preferredEditor, setPreferredEditor } from "@/features/files/editors";
import {
  agentModes,
  applyIdleGrace,
  idleGrace,
  setAgentMode,
  setIdleGrace,
  setSharedContext,
  setSplitCap,
  setViewLanding,
  sharedContext,
  splitCaps,
  viewLanding,
} from "@/features/settings/agentMode";
import { DockOrder } from "@/features/settings/DockOrder";
import { SettingsRow } from "@/features/settings/SettingsRow";
import { agents, complain, daemonVersion } from "@/shared/daemon";
import { type Locale, locale, setLocale, t } from "@/shared/i18n";
import { setThemeMode, type ThemeMode, themeMode } from "@/shared/theme/mode";
import { Choice } from "@/shared/ui/Choice";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { Segmented } from "@/shared/ui/Segmented";
import { Select } from "@/shared/ui/Select";

const THEMES: { value: ThemeMode; icon: IconName }[] = [
  { value: "system", icon: "monitor" },
  { value: "light", icon: "sun" },
  { value: "dark", icon: "moon" },
];

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const PANE_CAPS = [2, 3, 4, 5, 6, 8];

const IDLE_GRACES = [
  { value: 0, key: "settings.idleGrace0" },
  { value: 60, key: "settings.idleGrace60" },
  { value: 7200, key: "settings.idleGrace7200" },
] as const;

const THEME_HINT = {
  system: "settings.themeHint",
  light: "settings.themeHintLight",
  dark: "settings.themeHintDark",
} as const;

type Entry = {
  id: string;
  label: string;
  hint: string;
  control: VNode;
};

type Section = {
  id: string;
  label: string;
  entries: Entry[];
  panel?: VNode;
};

export function Settings() {
  const [appVersion, setAppVersion] = useState("");
  const [section, setSection] = useState("look");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void getVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePage();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const sections: Section[] = [
    {
      id: "look",
      label: t("settings.groupLook"),
      entries: [
        {
          id: "theme",
          label: t("settings.theme"),
          hint: t(THEME_HINT[themeMode.value]),
          control: (
            <Segmented label={t("settings.theme")}>
              {THEMES.map((option) => (
                <Choice
                  key={option.value}
                  selected={themeMode.value === option.value}
                  onSelect={() => setThemeMode(option.value)}
                >
                  <Icon name={option.icon} />
                  {t(`theme.${option.value}`)}
                </Choice>
              ))}
            </Segmented>
          ),
        },
        {
          id: "language",
          label: t("settings.language"),
          hint: t("settings.languageHint"),
          control: (
            <Segmented label={t("settings.language")}>
              {LANGUAGES.map((option) => (
                <Choice
                  key={option.value}
                  selected={locale.value === option.value}
                  onSelect={() => setLocale(option.value)}
                >
                  {option.label}
                </Choice>
              ))}
            </Segmented>
          ),
        },
      ],
    },
    {
      id: "space",
      label: t("settings.groupSpace"),
      entries: [
        {
          id: "editor",
          label: t("settings.editor"),
          hint: t("settings.editorHint"),
          control: (
            <Select
              label={t("settings.editor")}
              value={preferredEditor.value ?? ""}
              onSelect={(value) => setPreferredEditor(value === "" ? null : value)}
              options={[
                { value: "", label: t("settings.editorSystem") },
                ...installedEditors().map((editor) => ({
                  value: editor.id,
                  label: editor.name,
                })),
              ]}
            />
          ),
        },
        {
          id: "agentViews",
          label: t("settings.agentViews"),
          hint: t("settings.agentViewsHint"),
          control: (
            <Segmented label={t("settings.agentViews")}>
              <Choice selected={viewLanding.value === "tab"} onSelect={() => setViewLanding("tab")}>
                {t("settings.agentViewsTab")}
              </Choice>
              <Choice
                selected={viewLanding.value === "split"}
                onSelect={() => setViewLanding("split")}
              >
                {t("settings.agentViewsSplit")}
              </Choice>
            </Segmented>
          ),
        },
        ...(viewLanding.value === "split"
          ? [
              {
                id: "agentSplits",
                label: t("settings.agentSplits"),
                hint: t("settings.agentSplitsHint"),
                control: (
                  <div class="flex items-center gap-2">
                    <Select
                      label={t("settings.agentSplitsYours")}
                      value={String(splitCaps.value.yours)}
                      onSelect={(value) => setSplitCap("yours", Number(value))}
                      options={PANE_CAPS.map((panes) => ({
                        value: String(panes),
                        label: t("settings.agentSplitsYoursOption", { panes: String(panes) }),
                      }))}
                    />
                    <Select
                      label={t("settings.agentSplitsSpare")}
                      value={String(splitCaps.value.spare)}
                      onSelect={(value) => setSplitCap("spare", Number(value))}
                      options={PANE_CAPS.map((panes) => ({
                        value: String(panes),
                        label: t("settings.agentSplitsSpareOption", { panes: String(panes) }),
                      }))}
                    />
                  </div>
                ),
              },
            ]
          : []),
        {
          id: "sidebar",
          label: t("settings.sidebar"),
          hint: t("settings.sidebarHint"),
          control: <DockOrder />,
        },
      ],
    },
    {
      id: "agents",
      label: t("settings.groupAgents"),
      entries: [
        {
          id: "agents",
          label: t("settings.agents"),
          hint: t("settings.agentsHint2"),
          control: (
            <div class="flex flex-col gap-1.5">
              {agents.value
                .filter((agent) => agent.resolved_path !== null)
                .map((agent) => {
                  const sharing = sharedContext.value[agent.name] === true;
                  return (
                    <div key={agent.name} class="flex items-center justify-end gap-3">
                      <span class="text-muted">{agent.name}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={sharing}
                        disabled={!agent.shares_config}
                        title={t(
                          !agent.shares_config
                            ? "settings.shareContextNone"
                            : sharing
                              ? "settings.shareContextOn"
                              : "settings.shareContextOff",
                          { agent: agent.name },
                        )}
                        onClick={() => {
                          void setSharedContext(agent.name, !sharing).catch(complain);
                        }}
                        class={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 transition enabled:active:scale-[0.97]",
                          sharing
                            ? "border-accent bg-overlay text-accent"
                            : "border-border text-faint enabled:hover:text-text",
                          agent.shares_config ? "" : "cursor-not-allowed opacity-40",
                        )}
                      >
                        <Icon name="context" size={12} />
                        {t("settings.shareContext")}
                      </button>
                      <Segmented label={t("settings.agentMode", { agent: agent.name })}>
                        {(["pty", "acp"] as const).map((option) => (
                          <Choice
                            key={option}
                            selected={(agentModes.value[agent.name] ?? agent.mode) === option}
                            disabled={option === "acp" && !agent.speaks_acp}
                            title={
                              option === "acp" && !agent.speaks_acp
                                ? t("settings.agentNoAcp", { agent: agent.name })
                                : undefined
                            }
                            onSelect={() => setAgentMode(agent.name, option)}
                          >
                            {t(`isolation.${option}`)}
                          </Choice>
                        ))}
                      </Segmented>
                    </div>
                  );
                })}
            </div>
          ),
        },
      ],
    },
    {
      id: "daemon",
      label: t("settings.groupDaemon"),
      entries: [
        {
          id: "idleGrace",
          label: t("settings.idleGrace"),
          hint: t("settings.idleGraceHint"),
          control: (
            <Segmented label={t("settings.idleGrace")}>
              {IDLE_GRACES.map((option) => (
                <Choice
                  key={option.value}
                  selected={idleGrace.value === option.value}
                  onSelect={() => {
                    setIdleGrace(option.value);
                    applyIdleGrace();
                  }}
                >
                  {t(option.key)}
                </Choice>
              ))}
            </Segmented>
          ),
        },
      ],
    },
    {
      id: "about",
      label: t("settings.about"),
      entries: [],
      panel: (
        <dl class="flex flex-col gap-2">
          <Fact term={t("app.name")} value={appVersion || "—"} />
          <Fact term="apexd" value={daemonVersion.value ?? "—"} />
          <Fact term={t("settings.agentsPath")} value="~/.apex/agents" />
        </dl>
      ),
    },
  ];

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? sections
        .map((entry) => ({
          ...entry,
          entries: entry.entries.filter((row) =>
            `${row.label} ${row.hint}`.toLowerCase().includes(needle),
          ),
        }))
        .filter((entry) => entry.entries.length > 0)
    : sections.filter((entry) => entry.id === section);
  const panel = needle ? null : shown[0]?.panel;

  return (
    <div class="flex h-full min-h-0 flex-col bg-bg" role="region" aria-label={t("settings.title")}>
      <header class="flex min-h-8.5 shrink-0 select-none items-center gap-2 border-b border-border bg-surface px-3">
        <Icon name="settings" size={14} class="shrink-0 text-faint" />
        <span class="truncate text-text">{t("settings.title")}</span>
        <button
          type="button"
          title={t("settings.close")}
          onClick={closePage}
          class="ml-auto flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="close" />
        </button>
      </header>

      <div class="flex min-h-0 flex-1">
        <nav class="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border p-2">
          <input
            type="search"
            value={query}
            placeholder={t("settings.search")}
            autocomplete="off"
            spellcheck={false}
            onInput={(event) => setQuery(event.currentTarget.value)}
            class="mb-1 rounded border border-border bg-overlay px-2 py-1 text-text outline-none placeholder:text-faint focus:border-muted"
          />
          {sections.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setQuery("");
                setSection(entry.id);
              }}
              class={cn(
                "rounded px-2 py-1 text-left transition-colors",
                !needle && entry.id === section
                  ? "bg-raised text-text"
                  : "text-muted hover:bg-raised hover:text-text",
              )}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          <div class="mx-auto w-full max-w-5xl">
            {shown.length === 0 && <p class="text-faint">{t("settings.noMatch")}</p>}
            {panel}
            {shown.map((entry) => (
              <section key={entry.id}>
                {needle && (
                  <h3 class="pt-3 pb-1 text-micro uppercase tracking-wider text-faint first:pt-0">
                    {entry.label}
                  </h3>
                )}
                {entry.entries.map((row) => (
                  <SettingsRow key={row.id} label={row.label} hint={row.hint}>
                    {row.control}
                  </SettingsRow>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div class="flex items-baseline gap-3 border-b border-border pb-2 last:border-0">
      <dt class="min-w-0 flex-1 truncate text-muted">{term}</dt>
      <dd class="shrink-0 font-mono text-text tabular-nums">{value}</dd>
    </div>
  );
}
