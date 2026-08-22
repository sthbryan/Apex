import { Search } from "lucide-preact";
import { CommandItem, CommandPalette, Kbd, KbdGroup, Toast, ToastStack } from "@apex/ui";
import { SettingsModal } from "@/features/workspace/Settings";
import {
  Launcher, NotificationsPop, ProjectsPop, ResourcesPop, TargetPop, UsagePop,
} from "@/features/workspace/Workspace";
import { AgentIcon } from "@apex/ui";

export interface Overlay {
  id: string;
  label: string;
  kind: "popover" | "overlay";
  Component: () => any;
}

function Palette() {
  return (
    <CommandPalette open onClose={() => {}} lead={<Search size={15} />}>
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

export const OVERLAYS: Overlay[] = [
  { id: "settings", label: "Settings", kind: "overlay", Component: () => <SettingsModal inline /> },
  { id: "palette", label: "Command palette", kind: "overlay", Component: Palette },
  { id: "launcher", label: "Race launcher", kind: "overlay", Component: () => <Launcher inline /> },
  { id: "toasts", label: "Toasts", kind: "overlay", Component: Toasts },
  { id: "usage", label: "Usage", kind: "popover", Component: UsagePop },
  { id: "resources", label: "Resources", kind: "popover", Component: ResourcesPop },
  { id: "notifications", label: "Notifications", kind: "popover", Component: NotificationsPop },
  { id: "target", label: "Git target", kind: "popover", Component: TargetPop },
  { id: "projects", label: "Projects", kind: "popover", Component: ProjectsPop },
];
