import { useState } from "preact/hooks";
import { Check, Eye, GitBranch, X } from "lucide-preact";
import {
  activePanel, activeTab, approvedFirst, committed, gitStaged, launcherOpen, pickWinner,
} from "@/app/state";
import {
  BRANCH, CHANGES, COMMITS, CONTENDERS, CONTEXT_PINS, CONTEXT_SETUP, FILE_TREE,
  RACE_PROMPT, REVIEWS, SESSIONS, TASKS, WORKTREES,
} from "@/features/dock/fixtures";
import {
  AgentIcon, BranchBar, Button, Card, Chip, CommitBox, DiffStat, Dot, ListRow,
  SectionLabel, TreeRow,
} from "@apex/ui";

export const DOCK_PANELS = [
  { id: "sessions", label: "Sessions", Component: SessionsPanel },
  { id: "files", label: "Files", Component: FilesPanel },
  { id: "git", label: "Git · Changes", Component: GitPanel },
  { id: "review", label: "Review", Component: ReviewPanel },
  { id: "race", label: "Races", Component: RacePanel },
  { id: "history", label: "History", Component: HistoryPanel },
  { id: "context", label: "Context", Component: ContextPanel },
  { id: "tasks", label: "Tasks", Component: TasksPanel },
];

export function Panels() {
  const panel = DOCK_PANELS.find((p) => p.id === activePanel.value);
  return panel ? <panel.Component /> : null;
}

function SessionsPanel() {
  return (
    <div class="dock-view">
      <SectionLabel flush count={SESSIONS.length}>Running</SectionLabel>
      {SESSIONS.map((s) => (
        <ListRow
          key={s.id}
          label={s.name}
          sub={s.activity}
          selected={activeTab.value === s.tab}
          lead={<><Dot state={s.state} /><AgentIcon agent={s.agent} size="sm" /></>}
          trail={<span class="mono">{s.elapsed}</span>}
          onClick={() => activeTab.value = s.tab}
        />
      ))}
      <SectionLabel count={WORKTREES.length}>Worktrees</SectionLabel>
      {WORKTREES.map((w) => (
        <ListRow
          key={w.branch}
          label={w.branch}
          mono
          lead={<GitBranch size={13} style="color:var(--apex-muted)" />}
          trail={<span>{w.changed === 0 ? "clean" : `${w.changed} changed`}</span>}
        />
      ))}
    </div>
  );
}

function FilesPanel() {
  const [open, setOpen] = useState<string[]>(FILE_TREE.filter((n) => n.expanded).map((n) => n.name));
  return (
    <div class="dock-view">
      <SectionLabel flush>Workspace</SectionLabel>
      {FILE_TREE.map((node) => (
        <TreeRow
          key={node.name}
          name={node.name}
          depth={node.depth}
          status={node.status}
          expanded={node.expanded === undefined ? undefined : open.includes(node.name)}
          onClick={() => node.expanded === undefined ? undefined : setOpen((names) =>
            names.includes(node.name) ? names.filter((n) => n !== node.name) : [...names, node.name])}
        />
      ))}
    </div>
  );
}

function GitPanel() {
  const unstagedFirst = gitStaged.value ? CHANGES : CHANGES.map((c) => ({ ...c, staged: false }));
  const staged = unstagedFirst.filter((c) => c.staged);
  const changed = unstagedFirst.filter((c) => !c.staged);
  return (
    <div class="dock-view git-flex">
      <div class="git-scroll">
        <BranchBar
          branch={BRANCH.name}
          ahead={BRANCH.ahead}
          behind={BRANCH.behind}
          note={BRANCH.note}
          lead={<GitBranch size={12} />}
        />
        <SectionLabel count={staged.length}>Staged</SectionLabel>
        {staged.map((c) => <ChangeRow key={c.path} change={c} />)}
        <SectionLabel count={changed.length}>Changes</SectionLabel>
        {changed.map((c) => <ChangeRow key={c.path} change={c} />)}
      </div>
      <CommitBox
        class="dock-flush"
        placeholder="Commit message… (⌘↵)"
        hint={committed.value ?? `${staged.length} staged on ${BRANCH.name}`}
        submitDisabled={staged.length === 0}
        onSubmit={() => committed.value = `Committed as ${Math.random().toString(16).slice(2, 9)}`}
      />
    </div>
  );
}

function ChangeRow({ change }: { change: { path: string; added: number; removed: number; staged: boolean } }) {
  return (
    <ListRow
      as="div"
      label={change.path}
      mono
      lead={
        <span class="stage-box" data-on={change.staged || undefined}>
          <Check size={9} strokeWidth={3} />
        </span>
      }
      trail={<DiffStat added={change.added || undefined} removed={change.removed || undefined} />}
    />
  );
}

export function ReviewPanel() {
  return (
    <div class="dock-view">
      <SectionLabel flush count={REVIEWS.length}>Waiting on you</SectionLabel>
      {REVIEWS.map((r, i) => {
        const approved = approvedFirst.value && i === 0;
        return (
          <ListRow
            as="div"
            key={r.id}
            label={r.title}
            sub={approved
              ? "approved"
              : <>{r.branch} · {r.files} files<DiffStat added={r.added} removed={r.removed} /></>}
            lead={<AgentIcon agent={r.agent} size="sm" />}
            actions={approved ? undefined : (
              <>
                <Button variant="subtle" size="xs" iconOnly title="Open the diff"><Eye size={12} /></Button>
                <Button variant="danger" size="xs" iconOnly title="Reject"><X size={12} /></Button>
                <Button variant="primary" size="xs" iconOnly title="Approve"
                  onClick={() => approvedFirst.value = true}><Check size={12} /></Button>
              </>
            )}
            style={approved ? { opacity: 0.6 } : undefined}
          />
        );
      })}
    </div>
  );
}

function RacePanel() {
  return (
    <div class="dock-view">
      <SectionLabel flush count={1}>Running</SectionLabel>
      <Card elevation="raised" title={`“${RACE_PROMPT}”`}>
        <span class="dock-note">{CONTENDERS.length} contenders · no prompts · 4m 12s</span>
      </Card>
      {CONTENDERS.map((c) => (
        <ListRow
          as="div"
          key={c.agent}
          label={c.agent}
          sub={`${c.files} files · tests ${c.tests}`}
          lead={<AgentIcon agent={c.agent} size="sm" />}
          trail={c.state === "working" ? <Dot state="working" /> : <Chip tone="done">kept</Chip>}
          actions={c.state === "done" && !pickWinner.value
            ? <Button size="xs" onClick={() => pickWinner.value = true}>Keep {c.agent}</Button>
            : undefined}
        />
      ))}
      <Button variant="dashed" size="lg" class="mt-md" onClick={() => launcherOpen.value = true}>
        + Race a task across agents
      </Button>
    </div>
  );
}

function HistoryPanel() {
  return (
    <div class="dock-view">
      <SectionLabel flush>Recent · {BRANCH.name}</SectionLabel>
      {COMMITS.map((c) => (
        <ListRow
          key={c.sha}
          label={c.subject}
          lead={<span class="chash">{c.sha}</span>}
          trail={<span>{c.age}</span>}
        />
      ))}
    </div>
  );
}

function ContextPanel() {
  return (
    <div class="dock-view">
      <SectionLabel flush>AGENTS.md</SectionLabel>
      <Card elevation="raised">
        <div class="dock-code">{CONTEXT_SETUP.map((line) => <div key={line}>{line}</div>)}</div>
      </Card>
      <SectionLabel count={CONTEXT_PINS.length}>Pinned</SectionLabel>
      {CONTEXT_PINS.map((p) => (
        <ListRow as="div" key={p.path} label={p.path} mono trail={<span>{p.size}</span>} />
      ))}
    </div>
  );
}

function TasksPanel() {
  return (
    <div class="dock-view">
      <SectionLabel flush count={TASKS.length}>Active</SectionLabel>
      {TASKS.map((t) => (
        <ListRow
          as="div"
          key={t.command}
          label={t.command}
          mono
          sub={t.note}
          lead={<Dot state={t.state} />}
          trail={t.port
            ? <button class="url-chip" title={`Open localhost${t.port} in a pane`}
                onClick={() => activeTab.value = "tab-browser"}>{t.port}</button>
            : undefined}
        />
      ))}
    </div>
  );
}
