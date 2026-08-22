import { useState } from "preact/hooks";
import { Bell, Check, ChevronDown, Cpu, FileText, GitBranch, LayoutGrid, Plus, RotateCw, X } from "lucide-preact";
import { openPop, removedProject, uaWindow } from "@/app/state";
import {
  CPU, NOTICES, PROJECTS, RESOURCE_METERS, RESOURCE_SESSIONS, RESOURCE_TOTAL,
  TARGET, TARGET_BRANCHES, TARGET_WORKTREES, USAGE, USAGE_AGENTS, USAGE_WINDOWS,
} from "@/features/workspace/fixtures";
import type { Proc, Target } from "@/features/workspace/fixtures";
import {
  AgentIcon, Badge, Bar, Button, Chip, Dot, Glyph, ListRow, Meter, Notice, Pill, Popover,
  ProcessRow, ProjectButton, Readout, SectionLabel, Segmented, Spark, StatusPill,
} from "@apex/ui";

function toggle(id: string) {
  openPop.value = openPop.value === id ? null : id;
}

const close = () => openPop.value = null;

export interface PopProps {
  open?: boolean;
  onClose?: () => void;
}

function tone(pct: number) {
  if (pct >= 80) return "failed" as const;
  if (pct >= 60) return "blocked" as const;
  return "done" as const;
}

export function UsagePop({ open, onClose }: PopProps = {}) {
  const [unavailable, setUnavailable] = useState(true);
  const used = USAGE.used[uaWindow.value];
  return (
    <Popover
      open={open ?? openPop.value === "usage"}
      onClose={onClose ?? close}
      side="top"
      align="end"
      width={308}
      title={`${USAGE.agent} · usage`}
      meta={USAGE.updated}
      actions={
        <Button variant="subtle" size="xs" iconOnly aria-label="Refresh" title="Refresh">
          <RotateCw size={11} />
        </Button>
      }
      anchor={
        <StatusPill title="Subscription usage ⌘U" onClick={() => toggle("usage")}>
          <Bar class="w-9" size="sm" value={USAGE.used["5h"]} label="5h usage" />
          <Bar class="w-9" size="sm" value={USAGE_AGENTS[0].value} tone="blocked" label="codex 5h usage" />
          <span class="mono">{USAGE_AGENTS[0].value}%</span>
        </StatusPill>
      }
    >
      <Segmented
        class="self-start"
        label="Usage window"
        options={USAGE_WINDOWS.map((w) => ({ value: w.id, label: w.label }))}
        value={uaWindow.value}
        onChange={(v) => uaWindow.value = v as "5h" | "7d"}
      />
      <Readout value={`${used}%`} tone={tone(used)} note={USAGE.resets} />
      <Meter label="used" value={used} tick={USAGE.pace} detail={USAGE.paceNote} />
      <Meter label="7d" value={USAGE.week.value} tone="done" detail={USAGE.week.detail} />

      {USAGE_AGENTS.map((a) => a.unavailable && unavailable ? (
        <Notice
          key={a.agent}
          tone="failed"
          class="mt-1.5"
          lead={<AgentIcon agent={a.agent} size="sm" />}
          actions={<Button variant="subtle" size="xs" onClick={() => setUnavailable(false)}>Retry</Button>}
        >
          {a.agent} quota unavailable
        </Notice>
      ) : (
        <div key={a.agent}>
          <SectionLabel flush count={a.pace}>{a.agent}</SectionLabel>
          <Meter label={a.window} value={a.value} tone={a.tone} detail={a.detail} />
        </div>
      ))}
    </Popover>
  );
}

function ProcRow({ proc, onKill }: { proc: Proc; onKill: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Notice
        tone="failed"
        stacked
        class="ml-5"
        actions={
          <>
            <Button variant="subtle" size="xs" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="danger" size="xs" onClick={onKill}>End session</Button>
          </>
        }
      >
        End this session? The agent stops, the worktree stays.
      </Notice>
    );
  }

  const label = proc.agent ? `End the session running ${proc.cmd}` : `Kill ${proc.cmd} (${proc.pid})`;
  return (
    <ProcessRow
      command={proc.cmd}
      pid={proc.pid}
      mem={proc.mem}
      actions={
        <Button
          variant="subtle"
          size="xs"
          iconOnly
          title={label}
          aria-label={label}
          onClick={() => proc.agent ? setConfirming(true) : onKill()}
        >
          <X size={11} />
        </Button>
      }
    />
  );
}

export function ResourcesPop({ open, onClose }: PopProps = {}) {
  const [killed, setKilled] = useState<number[]>([]);
  const live = RESOURCE_SESSIONS
    .map((s) => ({ ...s, procs: s.procs.filter((p) => !killed.includes(p.pid)) }))
    .filter((s) => s.procs.length > 0);

  return (
    <Popover
      open={open ?? openPop.value === "resources"}
      onClose={onClose ?? close}
      side="top"
      align="end"
      width={308}
      title="Resources"
      meta="sampled every 5s"
      anchor={
        <StatusPill title="Machine resources" onClick={() => toggle("resources")}>
          <Cpu size={11} />
          <Bar class="w-9" size="sm" value={23} tone="blocked" label="CPU" />
          <span class="mono">18G</span>
        </StatusPill>
      }
    >
      <SectionLabel flush>CPU</SectionLabel>
      <Readout value={CPU.value} tone="working" note={CPU.note} />
      <Spark points={CPU.points} max={100} label="CPU over the last minute" />
      {RESOURCE_METERS.map((m) => (
        <Meter key={m.label} label={m.label} value={m.value} tone={m.tone} detail={m.detail} />
      ))}

      <SectionLabel flush count={RESOURCE_TOTAL}>Sessions and processes</SectionLabel>
      {live.length === 0 ? <Notice class="mt-1.5">Nothing running.</Notice> : live.map((s) => (
        <div class="proc-group" key={s.id}>
          <ListRow
            as="div"
            label={s.name}
            lead={<Dot state={s.state} />}
            trail={<span class="mono">{s.mem} · {s.pct}</span>}
          />
          {s.procs.map((p) => (
            <ProcRow
              key={p.pid}
              proc={p}
              onKill={() => setKilled((k) => [...k, ...(p.agent ? s.procs.map((x) => x.pid) : [p.pid])])}
            />
          ))}
        </div>
      ))}
    </Popover>
  );
}

export function NotificationsPop({ open, onClose }: PopProps = {}) {
  return (
    <Popover
      open={open ?? openPop.value === "notifications"}
      onClose={onClose ?? close}
      side="top"
      align="end"
      width={308}
      title="Notifications"
      anchor={
        <StatusPill title="Notifications" onClick={() => toggle("notifications")}>
          <Bell size={11} /><Badge tone="neutral">{NOTICES.length}</Badge>
        </StatusPill>
      }
    >
      {NOTICES.map((n) => (
        <ListRow key={n.id} label={n.title} sub={n.body} lead={<Dot state={n.state} />} trail={<span>{n.age}</span>} />
      ))}
    </Popover>
  );
}

function TargetRow({ target, trail, lead }: { target: Target; trail?: any; lead?: any }) {
  return (
    <ListRow
      label={target.name}
      sub={<span class="mono">{target.detail}</span>}
      lead={lead ?? (target.state ? <Dot state={target.state} /> : undefined)}
      trail={trail}
      class={target.dim ? "text-muted" : undefined}
    />
  );
}

export function TargetPop({ open, onClose }: PopProps = {}) {
  return (
    <Popover
      open={open ?? openPop.value === "target"}
      onClose={onClose ?? close}
      side="top"
      align="start"
      width={288}
      title="Where git commands run"
      anchor={
        <StatusPill title="Switch target" onClick={() => toggle("target")}>
          <GitBranch size={11} />
          <span class="mono">main</span>
          <span style="color:var(--apex-git-added)">↑2</span>
          <span style="color:var(--apex-state-blocked)">↓0</span>
        </StatusPill>
      }
    >
      <TargetRow
        target={{ id: "project", name: TARGET.name, detail: TARGET.detail }}
        lead={<span style="color:var(--apex-accent);display:flex"><Check size={13} /></span>}
        trail={<Chip>project</Chip>}
      />
      <SectionLabel flush count={TARGET_WORKTREES.length}>Worktrees</SectionLabel>
      {TARGET_WORKTREES.map((t) => <TargetRow key={t.id} target={t} />)}
      <SectionLabel flush>Branches</SectionLabel>
      {TARGET_BRANCHES.map((t) => (
        <TargetRow key={t.id} target={t} lead={<GitBranch size={12} style="color:var(--apex-muted)" />} />
      ))}
    </Popover>
  );
}

export function ProjectsPop({ open, onClose }: PopProps = {}) {
  const live = PROJECTS.filter((p) => !(p.id === "docs" && removedProject.value));
  return (
    <Popover
      open={open ?? openPop.value === "projects"}
      onClose={onClose ?? close}
      side="bottom"
      align="start"
      width={300}
      block
      title="Projects"
      anchor={
        <ProjectButton
          name={TARGET.name}
          path={`~/Documents/Codes/${TARGET.name}`}
          icon={<LayoutGrid size={13} />}
          alert="1 session waiting in another project"
          title="Switch project"
          trail={<ChevronDown size={12} style="color:var(--apex-muted);flex:none" />}
          onClick={() => toggle("projects")}
        />
      }
    >
      {live.map((p) => (
        <ListRow
          key={p.id}
          label={p.name}
          sub={<span class="mono">{p.path}</span>}
          lead={<Glyph size="sm">{p.current ? <Check size={11} /> : <FileText size={11} />}</Glyph>}
          trail={p.note ? <Pill tone={p.tone}>{p.note}</Pill> : undefined}
          actions={p.removable ? (
            <Button
              variant="subtle"
              size="xs"
              iconOnly
              title={`Remove ${p.name} from Apex`}
              onClick={(e) => { e.stopPropagation(); removedProject.value = true; }}
            >
              <X size={11} />
            </Button>
          ) : undefined}
        />
      ))}
      {removedProject.value ? <Notice tone="done">Removed apex-docs</Notice> : null}
      <ListRow label="Open project…" lead={<Glyph size="sm"><Plus size={11} /></Glyph>} />
    </Popover>
  );
}
