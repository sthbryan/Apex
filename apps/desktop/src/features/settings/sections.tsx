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
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { SHORTCUTS } from "@/app/keymap";
import type { AgentModel } from "@/bindings/AgentModel";
import type { ProviderStatus } from "@/bindings/ProviderStatus";
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
  addProvider,
  busy,
  chooseAgent,
  chosen,
  dropProvider,
  isSetUp,
  keepKey,
  loadModels,
  models,
  providers,
  slug,
  spellContext,
} from "@/features/settings/providers";
import {
  groupOn,
  OPTIONAL_GROUPS,
  type OptionalGroup,
  setGroupOn,
} from "@/features/settings/toolGroups";
import { autoUpdate, setAutoUpdate } from "@/features/updates/state";
import { UpdateAction, UpdateNote } from "@/features/updates/UpdateAction";
import { agents, complain, daemonVersion, platform, spell, stopDaemon } from "@/shared/daemon";
import { locale, setLocale, t } from "@/shared/i18n";
import { perfStatsEnabled, setPerfStatsEnabled } from "@/shared/perfStats";
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
      ...(import.meta.env.DEV
        ? [
            {
              id: "perfStats",
              label: t("settings.perfStats"),
              hint: t("settings.perfStatsHint"),
              control: (
                <Switch
                  label={t("settings.perfStats")}
                  checked={perfStatsEnabled.value}
                  onChange={setPerfStatsEnabled}
                />
              ),
            },
          ]
        : []),
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
            ...(platform.value === "macos"
              ? [
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
                  agent.speaks_acp && agent.speaks_pty ? (
                    <Segmented
                      size="sm"
                      label={t("settings.agentMode", { agent: agent.name })}
                      value={agentModes.value[agent.name] ?? agent.mode}
                      onChange={(option) => setAgentMode(agent.name, option)}
                      disabled={!on}
                      options={(["pty", "acp"] as const).map((option) => ({
                        value: option,
                        label: t(`isolation.${option}`),
                      }))}
                    />
                  ) : (
                    <span class="text-faint text-xs">{t(`isolation.${agent.mode}`)}</span>
                  )
                }
                actions={
                  <>
                    {raceUnattended.value && agent.speaks_pty && (
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
  api: ["settings.toolApi", "settings.toolApiSub"],
} as const;

const KEY_BOX =
  "h-(--apex-h-lg) w-full min-w-0 rounded-sm border border-border bg-raised px-2.5 text-sm text-text placeholder:text-faint focus:border-focus focus:outline-none";

const OWN = "";
const MORE = "+";

export function agentSection(): Section {
  return {
    id: "agent",
    label: t("settings.groupAgent"),
    sub: t("settings.groupAgentSub"),
    icon: "bot",
    entries: [],
    panel: <AgentPanel />,
  };
}

function AgentPanel() {
  const listed = providers.value;
  const picked = chosen.value;
  const ready = listed.filter(isSetUp);
  const [shown, setShown] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const at = ready.find((one) => one.name === (shown ?? picked?.provider)) ?? ready[0];

  if (adding) {
    return (
      <AddProvider
        free={listed.filter((one) => !isSetUp(one))}
        onCancel={() => setAdding(false)}
        onAdded={(name) => {
          setShown(name);
          setAdding(false);
        }}
      />
    );
  }

  return (
    <div class="flex flex-col">
      <Field
        label={t("settings.providerLabel")}
        hint={ready.length === 0 ? t("settings.providerNone") : undefined}
      >
        <Select
          size="lg"
          class="w-64"
          label={t("settings.providerLabel")}
          value={at?.name ?? MORE}
          placeholder={t("settings.providerMore")}
          onChange={(name) => (name === MORE ? setAdding(true) : setShown(name))}
          options={[
            ...ready.map((one) => ({ value: one.name, label: one.label })),
            { value: MORE, label: <span class="text-accent">{t("settings.providerMore")}</span> },
          ]}
        />
      </Field>
      {at && <ProviderDetail key={at.name} provider={at} onDropped={() => setShown(null)} />}
    </div>
  );
}

function ProviderDetail({
  provider,
  onDropped,
}: {
  provider: ProviderStatus;
  onDropped: () => void;
}) {
  const name = provider.name;
  const listed = models.value[name] ?? null;
  const working = busy.value === name;
  const picked = chosen.value;
  const [trouble, setTrouble] = useState<string | null>(null);

  useEffect(() => {
    if ((models.value[name] ?? null) === null) {
      loadModels(name).catch((cause) => setTrouble(spell(cause)));
    }
  }, [name]);

  return (
    <>
      <Field label={t("settings.modelLabel")} hint={provider.base_url ?? undefined}>
        <Select
          size="lg"
          class="w-64"
          label={t("settings.modelLabel")}
          value={picked?.provider === name ? picked.model : ""}
          placeholder={spellWaiting(listed, trouble)}
          disabled={working || !listed?.length}
          onChange={(model) => {
            if (model) {
              chooseAgent(name, model).catch((cause) => setTrouble(spell(cause)));
            }
          }}
          options={(listed ?? []).map((model) => ({
            value: model.id,
            label: (
              <span class="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <span class="truncate">{model.label}</span>
                {model.context !== null && (
                  <span class="shrink-0 text-faint text-xs">{spellContext(model.context)}</span>
                )}
              </span>
            ),
          }))}
        />
      </Field>

      <KeyRow provider={provider} onTrouble={setTrouble} />

      {trouble && <p class="border-danger border-l-2 py-2 pl-2.5 text-danger text-xs">{trouble}</p>}

      {(provider.added || provider.held === "keychain") && (
        <Field label={provider.label} hint={t("settings.providerRemoveHint")}>
          <Button
            size="md"
            variant="danger"
            disabled={working}
            onClick={() => {
              dropProvider(name)
                .then(onDropped)
                .catch((cause) => setTrouble(spell(cause)));
            }}
          >
            {t("settings.providerRemove")}
          </Button>
        </Field>
      )}
    </>
  );
}

function spellWaiting(listed: AgentModel[] | null, trouble: string | null): string {
  if (trouble) {
    return t("settings.agentModelNothing");
  }
  return listed === null ? t("settings.agentModelWait") : t("settings.agentModelNone");
}

function KeyRow({
  provider,
  onTrouble,
}: {
  provider: ProviderStatus;
  onTrouble: (trouble: string) => void;
}) {
  const [key, setKey] = useState("");
  const working = busy.value === provider.name;

  if (provider.keyless && provider.held === null) {
    return <Field label={t("settings.keyLabel")} hint={t("settings.keyNotNeeded")} />;
  }

  if (provider.held === "keychain") {
    return (
      <Field
        label={t("settings.keyLabel")}
        hint={
          provider.in_env
            ? t("settings.keyKeptOverEnv", { name: provider.env ?? "" })
            : t("settings.keyKept")
        }
      >
        <span class="text-faint text-sm">{"\u2022".repeat(8)}</span>
      </Field>
    );
  }

  const borrowed = provider.held === "environment";

  return (
    <Field
      layout="stacked"
      label={t("settings.keyLabel")}
      hint={
        borrowed
          ? t("settings.keyFromLaunch", { name: provider.env ?? "" })
          : t("settings.keyMissing")
      }
    >
      <form
        class="flex items-center gap-2"
        onSubmit={(event: Event) => {
          event.preventDefault();
          if (!key.trim()) {
            return;
          }
          keepKey(provider.name, key.trim())
            .then(() => setKey(""))
            .catch((cause) => onTrouble(spell(cause)));
        }}
      >
        <input
          type="password"
          value={key}
          spellcheck={false}
          aria-label={t("settings.keyFor", { provider: provider.label })}
          placeholder={t("settings.keyPlaceholder")}
          onInput={(event: JSX.TargetedEvent<HTMLInputElement>) =>
            setKey(event.currentTarget.value)
          }
          class={KEY_BOX}
        />
        <Button size="lg" variant="primary" type="submit" disabled={!key.trim() || working}>
          {working ? t("settings.keyChecking") : t("settings.keyKeep")}
        </Button>
      </form>
    </Field>
  );
}

function AddProvider({
  free,
  onCancel,
  onAdded,
}: {
  free: ProviderStatus[];
  onCancel: () => void;
  onAdded: (name: string) => void;
}) {
  const [which, setWhich] = useState(free[0]?.name ?? OWN);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [trouble, setTrouble] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const one = free.find((entry) => entry.name === which);
  const own = which === OWN;
  const name = own ? slug(label) : which;
  const wantsKey = own || !one?.keyless;
  const ready = own ? name.length > 0 && url.trim().length > 0 : !wantsKey || key.trim().length > 0;

  const send = (event: Event) => {
    event.preventDefault();
    setTrouble(null);
    setWorking(true);
    const done = own
      ? addProvider(name, label.trim(), url.trim(), key.trim())
      : keepKey(which, key.trim());
    done
      .then(() => onAdded(name))
      .catch((cause) => setTrouble(spell(cause)))
      .finally(() => setWorking(false));
  };

  return (
    <form class="flex flex-col" onSubmit={send}>
      <Field label={t("settings.providerWhich")}>
        <Select
          size="lg"
          class="w-64"
          label={t("settings.providerWhich")}
          value={which}
          onChange={setWhich}
          options={[
            ...free.map((entry) => ({ value: entry.name, label: entry.label })),
            { value: OWN, label: t("settings.providerOwn") },
          ]}
        />
      </Field>

      {own && (
        <>
          <Field
            layout="stacked"
            label={t("settings.providerName")}
            hint={name ? t("settings.providerNameHint", { name }) : undefined}
          >
            <input
              value={label}
              spellcheck={false}
              aria-label={t("settings.providerName")}
              placeholder={t("settings.providerNamePlaceholder")}
              onInput={(event: JSX.TargetedEvent<HTMLInputElement>) =>
                setLabel(event.currentTarget.value)
              }
              class={KEY_BOX}
            />
          </Field>
          <Field layout="stacked" label={t("settings.providerUrl")}>
            <input
              value={url}
              spellcheck={false}
              aria-label={t("settings.providerUrl")}
              placeholder="https://gateway.example/v1"
              onInput={(event: JSX.TargetedEvent<HTMLInputElement>) =>
                setUrl(event.currentTarget.value)
              }
              class={KEY_BOX}
            />
          </Field>
        </>
      )}

      {!own && one?.base_url && (
        <Field label={t("settings.providerUrl")}>
          <span class="text-faint text-sm">{one.base_url}</span>
        </Field>
      )}

      {wantsKey ? (
        <Field layout="stacked" label={t("settings.keyLabel")}>
          <input
            type="password"
            value={key}
            spellcheck={false}
            aria-label={t("settings.keyLabel")}
            placeholder={t("settings.keyPlaceholder")}
            onInput={(event: JSX.TargetedEvent<HTMLInputElement>) =>
              setKey(event.currentTarget.value)
            }
            class={KEY_BOX}
          />
        </Field>
      ) : (
        <Field label={t("settings.keyLabel")} hint={t("settings.keyNotNeeded")} />
      )}

      {trouble && <p class="border-danger border-l-2 py-2 pl-2.5 text-danger text-xs">{trouble}</p>}

      <div class="flex justify-end gap-2 pt-3">
        <Button size="lg" variant="subtle" type="button" onClick={onCancel}>
          {t("settings.providerCancel")}
        </Button>
        <Button size="lg" variant="primary" type="submit" disabled={!ready || working}>
          {working ? t("settings.keyChecking") : t("settings.providerAdd")}
        </Button>
      </div>
    </form>
  );
}

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

const SHORTCUT_GROUPS = ["navigation", "panes", "session"] as const;

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
