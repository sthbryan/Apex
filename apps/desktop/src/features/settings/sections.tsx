import {
  Button,
  DataRow,
  Field,
  IdentityCard,
  KbdGroup,
  SectionLabel,
  Segmented,
  Select,
  Slider,
  StatePill,
  Switch,
  ToggleChip,
  Wordmark,
} from "@apex/ui";
import { SHORTCUTS } from "@/app/keymap";
import { installedEditors, preferredEditor, setPreferredEditor } from "@/features/files/editors";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import {
  agentEnabled,
  agentModes,
  applyIdleGrace,
  idleGrace,
  notifyEnabled,
  raceUnattended,
  setAgentEnabled,
  setAgentMode,
  setAgentUnattended,
  setIdleGrace,
  setNotifyEnabled,
  setRaceUnattended,
  setSplitCap,
  setViewLanding,
  splitCaps,
  unattendedAgents,
  viewLanding,
} from "@/features/settings/agentMode";
import {
  frost,
  glassBlur,
  MAX_BLUR,
  MAX_CONTRAST,
  MIN_OPACITY,
  setFrost,
  setGlassBlur,
  setTranslucent,
  setUiScale,
  setVeilArea,
  setVeilContrast,
  setVeilOpacity,
  translucencySupported,
  translucent,
  uiScale,
  veilArea,
  veilContrast,
  veilOpacity,
} from "@/features/settings/appearance";
import { browsing, setBrowsing } from "@/features/settings/browsing";
import { cli, cliBusy, installCli, removeCli } from "@/features/settings/cli";
import { type Closing, closing, setClosing } from "@/features/settings/closing";
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
import {
  groupOn,
  OPTIONAL_GROUPS,
  type OptionalGroup,
  setGroupOn,
} from "@/features/settings/toolGroups";
import { autoUpdate, setAutoUpdate } from "@/features/updates/state";
import { UpdateAction, UpdateNote } from "@/features/updates/UpdateAction";
import { agents, complain, daemonVersion, stopDaemon } from "@/shared/daemon";
import { locale, setLocale, t } from "@/shared/i18n";
import { setThemeMode, themeMode } from "@/shared/theme/mode";
import { Icon } from "@/shared/ui/Icon";

export function lookSection(): Section {
  return {
    id: "look",
    label: t("settings.groupLook"),
    sub: t("settings.groupLookSub"),
    icon: "sparkles",
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
              id: "veilContrast",
              label: t("settings.veilContrast"),
              hint: t("settings.veilContrastHint"),
              control: (
                <Slider
                  label={t("settings.veilContrast")}
                  value={veilContrast.value}
                  min={0}
                  max={MAX_CONTRAST}
                  onChange={setVeilContrast}
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
    sub: t("settings.groupSpaceSub"),
    icon: "globe",
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
    sub: t("settings.groupAgentsSub"),
    icon: "bot",
    entries: [],
    panel: (
      <div class="flex flex-col">
        {agents.value
          .filter((agent) => agent.resolved_path !== null)
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((agent) => {
            const on = agentEnabled(agent.name);
            return (
              <DataRow
                key={agent.name}
                dim={!on}
                lead={<AgentIcon agent={agent.name} size="sm" />}
                label={agent.name}
                sub={t(agent.shares_config ? "settings.sharesContext" : "settings.ownContext")}
                trail={
                  <Segmented
                    size="sm"
                    label={t("settings.agentMode", { agent: agent.name })}
                    value={agentModes.value[agent.name] ?? agent.mode}
                    onChange={(option) => setAgentMode(agent.name, option)}
                    disabled={!on}
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
                }
                actions={
                  <>
                    {raceUnattended.value && (
                      <ToggleChip
                        size="sm"
                        pressed={unattendedAgents.value.includes(agent.name)}
                        disabled={!on}
                        title={t("race.yoloAgent", { agent: agent.name })}
                        onClick={() =>
                          setAgentUnattended(
                            agent.name,
                            !unattendedAgents.value.includes(agent.name),
                          )
                        }
                      >
                        {t("race.yoloShort")}
                      </ToggleChip>
                    )}
                    <Switch
                      label={t("settings.agentEnabled", { agent: agent.name })}
                      checked={on}
                      onChange={(next) => setAgentEnabled(agent.name, next)}
                    />
                  </>
                }
              />
            );
          })}
      </div>
    ),
  };
}

const TOOL_COPY = {
  observation: ["settings.toolObservation", "settings.toolObservationSub"],
  orchestration: ["settings.toolOrchestration", "settings.toolOrchestrationSub"],
  views: ["settings.toolViews", "settings.toolViewsSub"],
  browser: ["settings.toolBrowser", "settings.toolBrowserSub"],
} as const;

export function toolsSection(): Section {
  return {
    id: "tools",
    label: t("settings.groupTools"),
    sub: t("settings.groupToolsSub"),
    icon: "wrench",
    entries: OPTIONAL_GROUPS.map((group: OptionalGroup) => ({
      id: group,
      label: t(TOOL_COPY[group][0]),
      hint: t(TOOL_COPY[group][1]),
      control: (
        <Switch
          label={t(TOOL_COPY[group][0])}
          checked={groupOn(group)}
          onChange={(next) => {
            setGroupOn(group, next).catch(complain);
          }}
        />
      ),
    })),
  };
}

export function daemonSection(): Section {
  return {
    id: "daemon",
    label: t("settings.groupDaemon"),
    sub: t("settings.groupDaemonSub"),
    icon: "activity",
    entries: [
      {
        id: "closing",
        label: t("settings.closing"),
        hint: t("settings.closingHint"),
        control: (
          <Segmented
            label={t("settings.closing")}
            value={closing.value}
            onChange={(value) => setClosing(value as Closing)}
            options={[
              { value: "quit", label: t("settings.closingQuit") },
              { value: "tray", label: t("settings.closingTray") },
            ]}
          />
        ),
      },
      {
        id: "idleGrace",
        label: t("settings.idleGrace"),
        hint: t("settings.idleGraceHint"),
        control: (
          <Select
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
      {
        id: "cli",
        label: t("settings.cli"),
        hint: cliHint(),
        control: <CliControl />,
      },
      {
        id: "stopDaemon",
        label: t("settings.stopDaemon"),
        hint: t("settings.stopDaemonHint"),
        control: (
          <Button variant="danger" onClick={stopDaemon}>
            {t("settings.stopDaemonAction")}
          </Button>
        ),
      },
    ],
  };
}

function folderOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut > 0 ? path.slice(0, cut) : path;
}

function cliHint(): string {
  const state = cli.value;
  if (!state || (!state.linked && !state.occupied)) {
    return t("settings.cliHint");
  }
  if (state.occupied) {
    return t("settings.cliTaken", { path: state.path });
  }
  if (!state.on_path) {
    return t("settings.cliOffPath", { dir: folderOf(state.path) });
  }
  return t("settings.cliReady", { path: state.path });
}

function CliControl() {
  const state = cli.value;
  const busy = cliBusy.value;
  if (state?.linked) {
    return (
      <Button disabled={busy} onClick={() => void removeCli()}>
        {t("settings.cliRemove")}
      </Button>
    );
  }
  return (
    <Button variant="primary" disabled={busy || state?.occupied} onClick={() => void installCli()}>
      {t("settings.cliInstall")}
    </Button>
  );
}

export function aboutSection(appVersion: string): Section {
  const linked = daemonVersion.value !== null;
  const auto = (
    <Switch label={t("settings.updateAuto")} checked={autoUpdate.value} onChange={setAutoUpdate} />
  );
  return {
    id: "about",
    label: t("settings.about"),
    sub: t("settings.aboutSub"),
    icon: "help",
    entries: [
      {
        id: "autoUpdate",
        label: t("settings.updateAuto"),
        hint: t("settings.updateAutoHint"),
        control: auto,
      },
    ],
    panel: (
      <div class="flex flex-col gap-3">
        <IdentityCard
          icon={<img src="/brand/apex-icon.svg" alt="" width="44" height="44" />}
          name={<Wordmark size="sm">APEX</Wordmark>}
          sub={t("settings.product")}
          meta={`${appVersion ? `v${appVersion} · ` : ""}Tauri 2`}
          status={
            <StatePill state={linked ? "done" : "failed"}>
              {t(linked ? "settings.daemonLinked" : "settings.daemonLost")}
            </StatePill>
          }
          note={<UpdateNote />}
          action={<UpdateAction />}
        />
        <Field label={t("settings.updateAuto")} hint={t("settings.updateAutoHint")}>
          {auto}
        </Field>
        <div class="flex flex-col">
          <DataRow
            label="apexd"
            trail={<span class="font-mono">{daemonVersion.value ?? "…"}</span>}
          />
          <DataRow
            label={t("settings.agentsPath")}
            trail={<span class="font-mono">~/.apex/agents</span>}
          />
          <DataRow
            label={t("settings.configPath")}
            trail={<span class="font-mono">~/.apex/config.toml</span>}
          />
        </div>
      </div>
    ),
  };
}

const SHORTCUT_GROUPS = ["navigation", "panes"] as const;

export function shortcutsSection(): Section {
  return {
    id: "shortcuts",
    label: t("shortcuts.title"),
    sub: t("settings.shortcutsSub"),
    icon: "keyboard",
    entries: SHORTCUTS.map((shortcut) => ({
      id: shortcut.id,
      label: t(shortcut.label),
      hint: t(`shortcuts.groups.${shortcut.group}`),
      control: <KbdGroup keys={shortcut.keys} />,
    })),
    panel: (
      <div class="flex flex-col">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group}>
            <SectionLabel flush>{t(`shortcuts.groups.${group}`)}</SectionLabel>
            {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
              <DataRow
                key={shortcut.id}
                label={t(shortcut.label)}
                trail={<KbdGroup keys={shortcut.keys} />}
              />
            ))}
          </div>
        ))}
      </div>
    ),
  };
}
