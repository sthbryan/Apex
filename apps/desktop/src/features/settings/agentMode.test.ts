import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/daemon", () => ({
  agents: { value: [] },
  installedAgents: { value: [] },
  complain: () => {},
}));

import {
  agentEnabled,
  agentModes,
  disabledAgents,
  idleGrace,
  isMuted,
  lastAgent,
  modeOf,
  mutedSessions,
  notifyEnabled,
  raceUnattended,
  rememberAgent,
  runsUnattended,
  sessionMode,
  setAgentEnabled,
  setAgentMode,
  setAgentUnattended,
  setIdleGrace,
  setMuted,
  setNotifyEnabled,
  setRaceUnattended,
  setSplitCap,
  setViewLanding,
  splitCaps,
  unattendedAgents,
  viewLanding,
} from "./agentMode";

beforeEach(() => {
  localStorage.clear();
  agentModes.value = {};
  disabledAgents.value = [];
  lastAgent.value = null;
  idleGrace.value = 60;
  viewLanding.value = "tab";
  splitCaps.value = { yours: 5, spare: 6 };
  notifyEnabled.value = true;
  mutedSessions.value = [];
  raceUnattended.value = false;
  unattendedAgents.value = [];
});

describe("modeOf and setAgentMode", () => {
  it("falls back when no mode is stored", () => {
    expect(modeOf("agent", "pty")).toBe("pty");
  });

  it("stores and retrieves a mode", () => {
    setAgentMode("claude", "acp");
    expect(modeOf("claude", "pty")).toBe("acp");
  });

  it("uses the stored mode when a launcher does not override it", () => {
    setAgentMode("opencode", "acp");
    expect(sessionMode("opencode", "pty", null)).toBe("acp");
    expect(sessionMode("opencode", "pty", "pty")).toBe("pty");
  });
});

describe("agentEnabled", () => {
  it("disables and re-enables an agent", () => {
    setAgentEnabled("codex", false);
    expect(agentEnabled("codex")).toBe(false);
    setAgentEnabled("codex", true);
    expect(agentEnabled("codex")).toBe(true);
  });
});

describe("rememberAgent", () => {
  it("stores the last agent", () => {
    rememberAgent("claude");
    expect(lastAgent.value).toBe("claude");
  });
});

describe("idleGrace", () => {
  it("stores the value", () => {
    setIdleGrace(120);
    expect(idleGrace.value).toBe(120);
  });
});

describe("viewLanding and splitCaps", () => {
  it("stores landing", () => {
    setViewLanding("split");
    expect(viewLanding.value).toBe("split");
  });

  it("stores caps", () => {
    setSplitCap("yours", 3);
    expect(splitCaps.value.yours).toBe(3);
    setSplitCap("spare", 8);
    expect(splitCaps.value.spare).toBe(8);
  });
});

describe("notifyEnabled and muted", () => {
  it("toggles notify", () => {
    setNotifyEnabled(false);
    expect(notifyEnabled.value).toBe(false);
    setNotifyEnabled(true);
    expect(notifyEnabled.value).toBe(true);
  });

  it("mutes a session", () => {
    setMuted("s1", true);
    expect(isMuted("s1")).toBe(true);
    setMuted("s1", false);
    expect(isMuted("s1")).toBe(false);
  });
});

describe("runsUnattended", () => {
  it("checks race unattended flag and agent list", () => {
    setRaceUnattended(true);
    setAgentUnattended("codex", true);
    expect(runsUnattended("codex")).toBe(true);
    expect(runsUnattended("other")).toBe(false);
    setRaceUnattended(false);
    expect(runsUnattended("codex")).toBe(false);
  });
});
