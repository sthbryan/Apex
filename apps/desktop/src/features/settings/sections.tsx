import { Segmented, Select, Slider, Switch } from "@apex/ui";
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
  glassBlur,
  MAX_BLUR,
  MIN_OPACITY,
  setFrost,
  setGlassBlur,
  setTranslucent,
  setUiScale,
  setVeilArea,
  setVeilOpacity,
  translucencySupported,
  translucent,
  uiScale,
  veilArea,
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
  VEIL_AREA_LABEL,
  VEIL_AREAS,
} from "@/features/settings/constants";
import { DockOrder } from "@/features/settings/DockOrder";
import { Fact } from "@/features/settings/Fact";
import { agents, complain, daemonVersion } from "@/shared/daemon";
import { locale, setLocale, t } from "@/shared/i18n";
import { setThemeMode, themeMode } from "@/shared/theme/mode";
import { Icon } from "@/shared/ui/Icon";

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
          <Segmented
            label={t("settings.theme")}
            value={themeMode.value}
            onChange={setThemeMode}
            options={THEMES.map((option) => ({
              value: option.value,
              label: (
                <>
                  <Icon name={option.icon} />
                  {t(`theme.${option.value}`)}
                </>
              ),
            }))}
          />
        ),
      },
      {
        id: "uiScale",
        label: t("settings.uiScale"),
        hint: t("settings.uiScaleHint"),
        control: (
          <Segmented
            label={t("settings.uiScale")}
            value={uiScale.value}
            onChange={setUiScale}
            options={UI_SCALES.map((option) => ({
              value: option,
              label: t(UI_SCALE_LABEL[option]),
            }))}
          />
        ),
      },
      ...(translucencySupported.value
        ? [
            {
              id: "translucent",
              label: t("settings.translucent"),
              hint: t("settings.translucentHint"),
              control: (
                <Switch
                  label={t("settings.translucent")}
                  checked={translucent.value}
                  onChange={setTranslucent}
                />
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
                  value={veilOpacity.value}
                  min={MIN_OPACITY}
                  max={100}
                  onChange={setVeilOpacity}
                />
              ),
            },
            {
              id: "glassBlur",
              label: t("settings.glassBlur"),
              hint: t("settings.glassBlurHint"),
              control: (
                <Slider
                  label={t("settings.glassBlur")}
                  value={glassBlur.value}
                  min={0}
                  max={MAX_BLUR}
                  unit="px"
                  onChange={setGlassBlur}
                />
              ),
            },
            {
              id: "veilArea",
              label: t("settings.veilArea"),
              hint: t("settings.veilAreaHint"),
              control: (
                <Segmented
                  label={t("settings.veilArea")}
                  value={veilArea.value}
                  onChange={setVeilArea}
                  options={VEIL_AREAS.map((option) => ({
                    value: option,
                    label: t(VEIL_AREA_LABEL[option]),
                  }))}
                />
              ),
            },
            {
              id: "frost",
              label: t("settings.frost"),
              hint: t("settings.frostHint"),
              control: (
                <Segmented
                  label={t("settings.frost")}
                  value={frost.value}
                  onChange={setFrost}
                  options={FROSTS.map((option) => ({
                    value: option,
                    label: t(FROST_LABEL[option]),
                  }))}
                />
              ),
            },
          ]
        : []),
      {
        id: "language",
        label: t("settings.language"),
        hint: t("settings.languageHint"),
        control: (
          <Segmented
            label={t("settings.language")}
            value={locale.value}
            onChange={setLocale}
            options={LANGUAGES.map((option) => ({ value: option.value, label: option.label }))}
          />
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
            onChange={(value) => setPreferredEditor(value === "" ? null : value)}
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
          <Segmented
            label={t("settings.browsing")}
            value={browsing.value}
            onChange={setBrowsing}
            options={[
              { value: "internal", label: t("settings.browsingInternal") },
              { value: "system", label: t("settings.browsingSystem") },
            ]}
          />
        ),
      },
      {
        id: "agentViews",
        label: t("settings.agentViews"),
        hint: t("settings.agentViewsHint"),
        control: (
          <Segmented
            label={t("settings.agentViews")}
            value={viewLanding.value}
            onChange={setViewLanding}
            options={[
              { value: "tab", label: t("settings.agentViewsTab") },
              { value: "split", label: t("settings.agentViewsSplit") },
            ]}
          />
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
                    onChange={(value) => setSplitCap("yours", Number(value))}
                    options={PANE_CAPS.map((panes) => ({
                      value: String(panes),
                      label: t("settings.agentSplitsYoursOption", { panes: String(panes) }),
                    }))}
                  />
                  <Select
                    label={t("settings.agentSplitsSpare")}
                    value={String(splitCaps.value.spare)}
                    onChange={(value) => setSplitCap("spare", Number(value))}
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
          <Segmented
            label={t("race.yolo")}
            value={raceUnattended.value ? "on" : "off"}
            onChange={(value) => setRaceUnattended(value === "on")}
            options={[
              { value: "on", label: t("notify.on") },
              { value: "off", label: t("notify.off") },
            ]}
          />
        ),
      },
      {
        id: "notify",
        label: t("notify.enabled"),
        hint: t("notify.enabledHint"),
        control: (
          <Segmented
            label={t("notify.enabled")}
            value={notifyEnabled.value ? "on" : "off"}
            onChange={(value) => setNotifyEnabled(value === "on")}
            options={[
              { value: "on", label: t("notify.on") },
              { value: "off", label: t("notify.off") },
            ]}
          />
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
                    <Segmented
                      label={t("settings.agentMode", { agent: agent.name })}
                      value={agentModes.value[agent.name] ?? agent.mode}
                      onChange={(option) => setAgentMode(agent.name, option)}
                      options={(["pty", "acp"] as const).map((option) => ({
                        value: option,
                        label: t(`isolation.${option}`),
                        disabled: option === "acp" && !agent.speaks_acp,
                        title:
                          option === "acp" && !agent.speaks_acp
                            ? t("settings.agentNoAcp", { agent: agent.name })
                            : undefined,
                      }))}
                    />
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
          <Segmented
            label={t("settings.idleGrace")}
            value={String(idleGrace.value)}
            onChange={(value) => {
              setIdleGrace(Number(value));
              applyIdleGrace();
            }}
            options={IDLE_GRACES.map((option) => ({
              value: String(option.value),
              label: t(option.key),
            }))}
          />
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
