import { Menu, MenuItem, MenuSeparator, Toast, ToastStack } from "@apex/ui";
import { SettingsModal } from "@/features/workspace/Settings";
import { Launcher, Palette } from "@/features/workspace/Workspace";
import {
  NotificationsPop, ProjectsPop, ResourcesPop, TargetPop, UsagePop,
} from "@/features/workspace/Pops";
import { AgentIcon } from "@apex/ui";
import { ArrowLeftRight, Columns2, ExternalLink, Rows2, X } from "lucide-preact";

export interface Overlay {
  id: string;
  label: string;
  kind: "popover" | "overlay";
  Component: () => any;
  Live?: (props: { open: boolean; onClose: () => void }) => any;
}

function Toasts() {
  return (
    <ToastStack class="absolute!">
      <Toast title="Codex finished" detail="Fix the race settle flow · exit 0" tone="done"
        lead={<AgentIcon agent="codex" size="sm" />} onDismiss={() => {}} />
      <Toast title="Build failed" detail="exit 1" tone="failed"
        lead={<AgentIcon agent="claude" size="sm" />} onDismiss={() => {}} />
    </ToastStack>
  );
}

function PaneMenu() {
  return (
    <Menu label="Pane">
      <MenuItem lead={<Columns2 size={12} />}>Split right</MenuItem>
      <MenuItem lead={<Rows2 size={12} />}>Split down</MenuItem>
      <MenuItem lead={<ArrowLeftRight size={12} />}>Swap with the sibling</MenuItem>
      <MenuItem lead={<ExternalLink size={12} />}>Move to a tab</MenuItem>
      <MenuSeparator />
      <MenuItem lead={<X size={12} />} danger hint="⌘W">Close the pane</MenuItem>
    </Menu>
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
  { id: "menu", label: "Right click", kind: "popover", Component: PaneMenu },
  { id: "usage", label: "Usage", kind: "popover", Component: () => <UsagePop open onClose={noop} /> },
  { id: "resources", label: "Resources", kind: "popover", Component: () => <ResourcesPop open onClose={noop} /> },
  { id: "notifications", label: "Notifications", kind: "popover", Component: () => <NotificationsPop open onClose={noop} /> },
  { id: "target", label: "Git target", kind: "popover", Component: () => <TargetPop open onClose={noop} /> },
  { id: "projects", label: "Projects", kind: "popover", Component: () => <ProjectsPop open onClose={noop} /> },
];
