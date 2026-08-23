import cn from "cnfast";

import { installedEditors, preferredEditor, setPreferredEditor } from "@/features/files/editors";
import {
  agentModes,
  applyIdleGrace,
  idleGrace,
  notifyEnabled,
  raceUnattended,
  setAgentMode,
  setAgentUnattended,
  setIdleGrace,
  setNotifyEnabled,
  setRaceUnattended,
  setSharedContext,
  setSplitCap,
  setViewLanding,
  sharedContext,
  splitCaps,
  unattendedAgents,
  viewLanding,
} from "@/features/settings/agentMode";
import {
  frost,
  MIN_OPACITY,
  setFrost,
  setTranslucent,
  setUiScale,
  setVeilOpacity,
  translucencySupported,
  translucent,
  uiScale,
  veilOpacity,
} from "@/features/settings/appearance";
import { browsing, setBrowsing } from "@/features/settings/browsing";
import {
  FROST_LABEL,
  FROSTS,
  IDLE_GRACES,
  LANGUAGES,
  PANE_CAPS,
  type Section,
  THEME_HINT,
  THEMES,
  UI_SCALE_LABEL,
  UI_SCALES,
} from "@/features/settings/constants";
import { DockOrder } from "@/features/settings/DockOrder";
import { Fact } from "@/features/settings/Fact";
import { agents, complain, daemonVersion } from "@/shared/daemon";
import { locale, setLocale, t } from "@/shared/i18n";
import { setThemeMode, themeMode } from "@/shared/theme/mode";
import { Choice } from "@/shared/ui/Choice";
import { Icon } from "@/shared/ui/Icon";
import { Segmented } from "@/shared/ui/Segmented";
import { Select } from "@/shared/ui/Select";
import { Slider } from "@/shared/ui/Slider";

export function lookSection(): Section {
  return {
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
        id: "uiScale",
        label: t("settings.uiScale"),
        hint: t("settings.uiScaleHint"),
        control: (
          <Segmented label={t("settings.uiScale")}>
            {UI_SCALES.map((option) => (
              <Choice
                key={option}
                selected={uiScale.value === option}
                onSelect={() => setUiScale(option)}
              >
                {t(UI_SCALE_LABEL[option])}
              </Choice>
            ))}
          </Segmented>
        ),
      },
      ...(translucencySupported.value
        ? [
            {
              id: "translucent",
              label: t("settings.translucent"),
              hint: t("settings.translucentHint"),
              control: (
                <Segmented label={t("settings.translucent")}>
                  <Choice selected={translucent.value} onSelect={() => setTranslucent(true)}>
                    {t("settings.translucentOn")}
                  </Choice>
                  <Choice selected={!translucent.value} onSelect={() => setTranslucent(false)}>
                    {t("settings.translucentOff")}
                  </Choice>
                </Segmented>
              ),
            },
          ]
        : []),
      ...(translucencySupported.value && translucent.value
        ? [
            {
              id: "opacity",
              label: t("settings.opacity"),
              hint: t("settings.opacityHint"),
              control: (
                <Slider
                  label={t("settings.opacity")}
                  value={100 - veilOpacity.value}
                  min={0}
                  max={100 - MIN_OPACITY}
                  format={(value) => `${value}%`}
                  onChange={(value) => setVeilOpacity(100 - value)}
                />
              ),
            },
            {
              id: "frost",
              label: t("settings.frost"),
              hint: t("settings.frostHint"),
              control: (
                <Segmented label={t("settings.frost")}>
                  {FROSTS.map((option) => (
                    <Choice
                      key={option}
                      selected={frost.value === option}
                      onSelect={() => setFrost(option)}
                    >
                      {t(FROST_LABEL[option])}
                    </Choice>
                  ))}
                </Segmented>
              ),
            },
          ]
        : []),
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
  };
}

export function spaceSection(): Section {
  return {
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
        id: "browsing",
        label: t("settings.browsing"),
        hint: t("settings.browsingHint"),
        control: (
          <Segmented label={t("settings.browsing")}>
            <Choice
              selected={browsing.value === "internal"}
              onSelect={() => setBrowsing("internal")}
            >
              {t("settings.browsingInternal")}
            </Choice>
            <Choice selected={browsing.value === "system"} onSelect={() => setBrowsing("system")}>
              {t("settings.browsingSystem")}
            </Choice>
          </Segmented>
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
        id: "yolo",
        label: t("race.yolo"),
        hint: t("race.yoloHint"),
        control: (
          <Segmented label={t("race.yolo")}>
            <Choice selected={raceUnattended.value} onSelect={() => setRaceUnattended(true)}>
              {t("notify.on")}
            </Choice>
            <Choice selected={!raceUnattended.value} onSelect={() => setRaceUnattended(false)}>
              {t("notify.off")}
            </Choice>
          </Segmented>
        ),
      },
      {
        id: "notify",
        label: t("notify.enabled"),
        hint: t("notify.enabledHint"),
        control: (
          <Segmented label={t("notify.enabled")}>
            <Choice selected={notifyEnabled.value} onSelect={() => setNotifyEnabled(true)}>
              {t("notify.on")}
            </Choice>
            <Choice selected={!notifyEnabled.value} onSelect={() => setNotifyEnabled(false)}>
              {t("notify.off")}
            </Choice>
          </Segmented>
        ),
      },
      {
        id: "sidebar",
        label: t("settings.sidebar"),
        hint: t("settings.sidebarHint"),
        control: <DockOrder />,
      },
    ],
  };
}

export function agentsSection(): Section {
  return {
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
                    <button
                      type="button"
                      role="switch"
                      aria-checked={unattendedAgents.value.includes(agent.name)}
                      disabled={!raceUnattended.value}
                      title={t("race.yoloAgent", { agent: agent.name })}
                      onClick={() =>
                        setAgentUnattended(agent.name, !unattendedAgents.value.includes(agent.name))
                      }
                      class={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1 transition enabled:active:scale-[0.97]",
                        unattendedAgents.value.includes(agent.name)
                          ? "border-git-removed bg-overlay text-git-removed"
                          : "border-border text-faint enabled:hover:text-text",
                        raceUnattended.value ? "" : "cursor-not-allowed opacity-40",
                      )}
                    >
                      <Icon name="swap" size={12} />
                      {t("race.yoloShort")}
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
  };
}

export function daemonSection(): Section {
  return {
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
  };
}

export function aboutSection(appVersion: string): Section {
  return {
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
  };
}
