import {
  Activity,
  ArrowRightLeft,
  BookMarked,
  Check,
  ChevronDown,
  CirclePlay,
  CircleStop,
  Cpu,
  ExternalLink,
  File,
  Folder,
  GitBranch,
  Gpu,
  History,
  type LucideIcon,
  MemoryStick,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  RefreshCw,
  Settings2,
  SquareTerminal,
  Sun,
  X,
} from "lucide-preact";

const ICONS = {
  settings: Settings2,
  plus: Plus,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  refresh: RefreshCw,
  close: X,
  chevron: ChevronDown,
  panel: PanelLeft,
  activity: Activity,
  sessions: SquareTerminal,
  files: Folder,
  branch: GitBranch,
  history: History,
  context: BookMarked,
  play: CirclePlay,
  stop: CircleStop,
  check: Check,
  file: File,
  external: ExternalLink,
  cpu: Cpu,
  gpu: Gpu,
  memory: MemoryStick,
  swap: ArrowRightLeft,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  class?: string;
};

export function Icon({ name, size = 14, class: className }: Props) {
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" class={className} />;
}
