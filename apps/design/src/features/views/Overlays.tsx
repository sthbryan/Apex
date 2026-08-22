import { Search } from "lucide-preact";
import { CommandItem, CommandPalette, Kbd, KbdGroup, Toast, ToastStack } from "@apex/ui";
import { SettingsModal } from "@/features/workspace/Settings";
import { Launcher } from "@/features/workspace/Workspace";
import {
  NotificationsPop, ProjectsPop, ResourcesPop, TargetPop, UsagePop,
} from "@/features/workspace/Pops";
import { AgentIcon } from "@apex/ui";

export interface Overlay {
  id: string;
  label: string;
  kind: "popover" | "overlay";
  Component: () => any;
  Live?: (props: { open: boolean; onClose: () => void }) => any;
}

function Palette({ open = true, onClose, live }: { open?: boolean; onClose?: () => void; live?: boolean } = {}) {
  return (
    <CommandPalette open={open} onClose={onClose ?? (() => {})} autoFocus={live} lead={<Search size={15} />}>
      <CommandItem name="New session" desc="In a new tab" selected trail={<KbdGroup keys={["⌘", "N"]} />} />
      <CommandItem name="Race a task across agents" desc="Fan one task out, keep the winner" trail={<KbdGroup keys={["⌘", "R"]} />} />
      <CommandItem name="Open settings" trail={<KbdGroup keys={["⌘", ","]} />} />
      <CommandItem name="Toggle the sidebar" trail={<KbdGroup keys={["⌘", "B"]} />} />
      <CommandItem name="Go to file…" trail={<Kbd>⌘P</Kbd>} />
    </CommandPalette>
  );
}

function Toasts() {
  return (
    <ToastStack class="!absolute">
      <Toast title="Codex finished" detail="Fix the race settle flow · exit 0" tone="done"
        lead={<AgentIcon agent="codex" size="sm" />} onDismiss={() => {}} />
      <Toast title="Build failed" detail="exit 1" tone="failed"
        lead={<AgentIcon agent="claude" size="sm" />} onDismiss={() => {}} />
    </ToastStack>
  );
}

const noop = () => {};

export const OVERLAYS: Overlay[] = [
  {
    id: "settings",
    label: "Settings",
    kind: "overlay",
    Component: () => <SettingsModal inline />,
    Live: ({ open, onClose }) => <SettingsModal open={open} onClose={onClose} />,
  },
  {
    id: "palette",
    label: "Command palette",
    kind: "overlay",
    Component: Palette,
    Live: ({ open, onClose }) => (open ? <Palette open live onClose={onClose} /> : null),
  },
  {
    id: "launcher",
    label: "Race launcher",
    kind: "overlay",
    Component: () => <Launcher inline />,
    Live: ({ open, onClose }) => <Launcher open={open} onClose={onClose} />,
  },
  { id: "toasts", label: "Toasts", kind: "overlay", Component: Toasts },
  { id: "usage", label: "Usage", kind: "popover", Component: () => <UsagePop open onClose={noop} /> },
  { id: "resources", label: "Resources", kind: "popover", Component: () => <ResourcesPop open onClose={noop} /> },
  { id: "notifications", label: "Notifications", kind: "popover", Component: () => <NotificationsPop open onClose={noop} /> },
  { id: "target", label: "Git target", kind: "popover", Component: () => <TargetPop open onClose={noop} /> },
  { id: "projects", label: "Projects", kind: "popover", Component: () => <ProjectsPop open onClose={noop} /> },
];
