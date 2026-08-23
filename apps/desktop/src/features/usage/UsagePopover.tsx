import { Button, Meter, Notice, Popover, Readout, SectionLabel, Segmented } from "@apex/ui";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { QuotaReport } from "@/bindings/QuotaReport";
import type { QuotaWindow } from "@/bindings/QuotaWindow";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { countdown, pacing, resetIn, resetText } from "@/features/usage/format";
import { barTone, readoutTone } from "@/features/usage/tone";
import { t } from "@/shared/i18n";
import { refreshQuota } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  open: boolean;
  reports: QuotaReport[];
  failures: string[];
  anchor: ComponentChildren;
  onClose: () => void;
};

function nameOf(window: QuotaWindow, index: number): string {
  return window.label ?? `#${index + 1}`;
}

function detailOf(window: QuotaWindow): string {
  return pacing(window)?.text ?? resetIn(window) ?? "";
}

export function UsagePopover({ open, reports, failures, anchor, onClose }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  const [lead, ...rest] = reports;
  const windows = lead?.windows ?? [];
  const picked = windows.find((window, index) => nameOf(window, index) === chosen) ?? windows[0];
  const others = windows.filter((window) => window !== picked);

  const updatedAgo = reports.some((report) => report.updated_at)
    ? countdown(
        (Date.now() -
          Math.max(...reports.map((report) => new Date(report.updated_at ?? 0).getTime()))) /
          1000,
      )
    : null;

  const reload = () => {
    setRefreshing(true);
    void refreshQuota().finally(() => setRefreshing(false));
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      side="top"
      align="start"
      width={308}
      label={t("usage.title")}
      title={lead ? `${lead.agent} · ${t("usage.word")}` : t("usage.title")}
      meta={updatedAgo ? t("usage.updatedAgo", { away: updatedAgo }) : undefined}
      actions={
        <Button
          variant="subtle"
          size="xs"
          iconOnly
          title={t("resources.refresh")}
          aria-label={t("resources.refresh")}
          onClick={reload}
        >
          <Icon name="refresh" size={11} class={refreshing ? "animate-spin" : undefined} />
        </Button>
      }
    >
      {!lead && failures.length === 0 && <p class="text-faint">{t("resources.noQuota")}</p>}

      {lead && windows.length > 1 && (
        <Segments
          windows={windows}
          picked={picked ? nameOf(picked, windows.indexOf(picked)) : ""}
          onPick={setChosen}
        />
      )}

      {picked && (
        <Readout
          value={`${picked.used_percent}%`}
          tone={readoutTone(picked.used_percent)}
          note={resetText(picked)}
        />
      )}

      {picked && (
        <Meter
          label={t("usage.used")}
          value={picked.used_percent}
          tone={barTone(picked.used_percent)}
          tick={picked.expected_percent ?? undefined}
          detail={detailOf(picked)}
        />
      )}

      {others.map((window, index) => (
        <Meter
          key={nameOf(window, index)}
          label={nameOf(window, index)}
          value={window.used_percent}
          tone={barTone(window.used_percent)}
          tick={window.expected_percent ?? undefined}
          detail={detailOf(window)}
        />
      ))}

      {rest.map((report) => {
        const worst = report.windows.reduce((tight, window) =>
          window.used_percent > tight.used_percent ? window : tight,
        );
        return (
          <div key={report.agent}>
            <SectionLabel flush count={pacing(worst)?.text}>
              {report.agent}
            </SectionLabel>
            <Meter
              label={nameOf(worst, report.windows.indexOf(worst))}
              value={worst.used_percent}
              tone={barTone(worst.used_percent)}
              tick={worst.expected_percent ?? undefined}
              detail={detailOf(worst)}
            />
          </div>
        );
      })}

      {failures.map((agent) => (
        <Notice
          key={agent}
          tone="failed"
          class="mt-1.5"
          lead={<AgentIcon agent={agent} size="sm" />}
          actions={
            <Button variant="subtle" size="xs" onClick={reload}>
              {t("usage.retry")}
            </Button>
          }
        >
          {t("usage.agentUnavailable", { agent })}
        </Notice>
      ))}
    </Popover>
  );
}

function Segments({
  windows,
  picked,
  onPick,
}: {
  windows: QuotaWindow[];
  picked: string;
  onPick: (name: string) => void;
}) {
  return (
    <Segmented
      class="self-start"
      size="sm"
      label={t("usage.window")}
      value={picked}
      options={windows.map((window, index) => ({
        value: nameOf(window, index),
        label: nameOf(window, index),
      }))}
      onChange={onPick}
    />
  );
}
