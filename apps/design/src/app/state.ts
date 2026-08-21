import { signal } from "@preact/signals";

export const page = signal<"workspace" | "toolkit">("workspace");
export const activePanel = signal<string>("summary");
export const railOnly = signal(false);
export const showWelcome = signal(true);
export const activeTab = signal("tab-auth");
export const openPop = signal<string | null>(null);
export const paletteOpen = signal(false);
export const settingsOpen = signal(false);
export const settingsSection = signal("look");
export const launcherOpen = signal(false);

export const raceKept = signal(false);
export const raceAsking = signal(false);
export const pickWinner = signal(false);

export const gitStaged = signal(true);
export const committed = signal<string | null>(null);
export const approvedFirst = signal(false);
export const fmode = signal<"preview" | "source">("preview");
export const consoleOpen = signal(false);
export const uaWindow = signal<"5h" | "7d">("5h");
export const removedProject = signal(false);
export const updateState = signal("You are up to date · checked 2h ago");
export const toastCount = signal(2);
