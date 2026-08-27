import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderStatus } from "@/bindings/ProviderStatus";
import {
  chosen,
  isSetUp,
  models,
  providers,
  slug,
  spellContext,
} from "@/features/settings/providers";
import { agentSection } from "@/features/settings/sections";
import { spell } from "@/shared/daemon";
import { render } from "@/test/render";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));

function provider(over: Partial<ProviderStatus>): ProviderStatus {
  return {
    name: "openai",
    label: "OpenAI",
    base_url: null,
    env: "OPENAI_API_KEY",
    keyless: false,
    added: false,
    held: null,
    ...over,
  };
}

const MINIMAX = provider({
  name: "minimax",
  label: "MiniMax",
  base_url: "https://api.minimax.io/v1",
  env: "MINIMAX_API_KEY",
  held: "environment",
});
const KEPT = provider({ held: "keychain" });
const BARE = provider({ name: "groq", label: "Groq", env: "GROQ_API_KEY" });

function panel() {
  const section = agentSection();
  if (!section.panel) {
    throw new Error("the agent panel is missing");
  }
  return render(section.panel).container;
}

function labels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".ui-field-label")).map(
    (node) => node.textContent ?? "",
  );
}

function options(container: HTMLElement, label: string): string[] {
  const trigger = container.querySelector<HTMLButtonElement>(
    `.ui-select-trigger[aria-label="${label}"]`,
  );
  if (!trigger) {
    throw new Error(`no ${label} select`);
  }
  act(() => trigger.click());
  return Array.from(container.querySelectorAll(".ui-select-option")).map(
    (node) => node.textContent ?? "",
  );
}

beforeEach(() => {
  providers.value = [];
  chosen.value = null;
  models.value = {};
});

describe("which providers reach the panel", () => {
  it("counts a key or a file of its own as set up, and nothing else", () => {
    expect(isSetUp(MINIMAX)).toBe(true);
    expect(isSetUp(KEPT)).toBe(true);
    expect(isSetUp(provider({ added: true }))).toBe(true);
    expect(isSetUp(BARE)).toBe(false);
    expect(isSetUp(provider({ keyless: true }))).toBe(false);
  });

  it("offers only the ones that are set up, and a way to add another", () => {
    providers.value = [MINIMAX, KEPT, BARE];
    chosen.value = { provider: "minimax", model: "MiniMax-M3" };

    expect(options(panel(), "Provider")).toEqual(["MiniMax", "OpenAI", "Add a provider…"]);
  });

  it("says there is nothing yet when none of them are set up", () => {
    providers.value = [BARE];

    const container = panel();
    expect(container.textContent).toContain("None set up yet");
    expect(options(container, "Provider")).toEqual(["Add a provider…"]);
  });
});

describe("taking a provider away", () => {
  it("offers to remove one whose key Apex itself keeps", () => {
    providers.value = [KEPT];

    expect(labels(panel())).toContain("OpenAI");
  });

  it("will not pretend it can remove a key that lives in your shell", () => {
    providers.value = [MINIMAX];

    const container = panel();
    expect(labels(container)).not.toContain("MiniMax");
    expect(container.textContent).toContain("MINIMAX_API_KEY");
  });
});

describe("spelling things out", () => {
  it("turns a name into something that can be a filename", () => {
    expect(slug(" My Gateway ")).toBe("my-gateway");
    expect(slug("Zed's AI!")).toBe("zed-s-ai");
    expect(slug("---")).toBe("");
  });

  it("shortens a context window without lying about it", () => {
    expect(spellContext(999)).toBe("999");
    expect(spellContext(128_000)).toBe("128K");
    expect(spellContext(204_800)).toBe("205K");
    expect(spellContext(1_000_000)).toBe("1M");
  });

  it("drops the protocol code the daemon puts in front of its complaints", () => {
    expect(spell(new Error("Internal: Ollama did not answer"))).toBe("Ollama did not answer");
    expect(spell(new Error("NotFound: no such provider"))).toBe("no such provider");
    expect(spell(new Error("Ollama: did not answer"))).toBe("Ollama: did not answer");
    expect(spell("plain trouble")).toBe("plain trouble");
  });
});
