import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/preact";

const { Mock } = vi.hoisted(() => {
  const { h } = require("preact");
  const Mock = (props: { size?: number; class?: string }) => h("svg", { width: String(props.size), class: props.class, "data-mock": "icon" });
  return { Mock };
});

vi.mock("lucide-preact", () => ({
  Activity: Mock,
  ArrowDownToLine: Mock,
  ArrowRightLeft: Mock,
  ArrowUpFromLine: Mock,
  Atom: Mock,
  Bell: Mock,
  BellOff: Mock,
  BookMarked: Mock,
  Bot: Mock,
  Braces: Mock,
  Brain: Mock,
  Check: Mock,
  ChevronDown: Mock,
  ChevronLeft: Mock,
  ChevronRight: Mock,
  Circle: Mock,
  CircleHelp: Mock,
  CirclePlay: Mock,
  CircleStop: Mock,
  Columns2: Mock,
  Combine: Mock,
  Cpu: Mock,
  Database: Mock,
  ExternalLink: Mock,
  File: Mock,
  FileArchive: Mock,
  FileCode: Mock,
  FileCog: Mock,
  FileImage: Mock,
  FileJson: Mock,
  FileLock: Mock,
  FileText: Mock,
  Folder: Mock,
  FolderGit: Mock,
  Gem: Mock,
  GitBranch: Mock,
  Globe: Mock,
  Gpu: Mock,
  History: Mock,
  House: Mock,
  Inbox: Mock,
  Keyboard: Mock,
  LayoutGrid: Mock,
  MemoryStick: Mock,
  Monitor: Mock,
  Moon: Mock,
  MoveHorizontal: Mock,
  PanelLeft: Mock,
  PanelLeftClose: Mock,
  PanelLeftOpen: Mock,
  Pencil: Mock,
  PencilRuler: Mock,
  Plus: Mock,
  RefreshCw: Mock,
  Rocket: Mock,
  Rows3: Mock,
  Save: Mock,
  Send: Mock,
  Settings2: Mock,
  Sparkles: Mock,
  SquareSplitHorizontal: Mock,
  SquareSplitVertical: Mock,
  SquareTerminal: Mock,
  Sun: Mock,
  Undo2: Mock,
  X: Mock,
}));

import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders the glyph", () => {
    const { container } = render(<Icon name="settings" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies size and class", () => {
    const { container } = render(<Icon name="close" size={20} class="my-class" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.classList.contains("my-class")).toBe(true);
  });

  it("renders different names without crashing", () => {
    const { container: a } = render(<Icon name="plus" />);
    const { container: b } = render(<Icon name="check" />);
    expect(a.querySelector("svg")).not.toBeNull();
    expect(b.querySelector("svg")).not.toBeNull();
  });
});
