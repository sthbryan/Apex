import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { AgentChoice } from "@/bindings/AgentChoice";
import type { AgentModel } from "@/bindings/AgentModel";
import type { ProviderStatus } from "@/bindings/ProviderStatus";
import { complain } from "@/shared/daemon";

export const providers = signal<ProviderStatus[]>([]);
export const chosen = signal<AgentChoice | null>(null);
export const models = signal<Record<string, AgentModel[]>>({});
export const busy = signal<string | null>(null);

export async function loadProviders(): Promise<void> {
  providers.value = await invoke<ProviderStatus[]>("list_providers");
  chosen.value = await invoke<AgentChoice | null>("agent_chosen");
}

export async function keepKey(provider: string, key: string): Promise<void> {
  busy.value = provider;
  try {
    await invoke("keep_provider_key", { provider, key });
    await loadProviders();
    await loadModels(provider);
  } finally {
    busy.value = null;
  }
}

export async function addProvider(
  name: string,
  label: string,
  baseUrl: string,
  key: string,
): Promise<void> {
  busy.value = name;
  try {
    await invoke("add_provider", { name, label, baseUrl, key });
    await loadProviders();
    await loadModels(name);
  } finally {
    busy.value = null;
  }
}

export async function dropProvider(provider: string): Promise<void> {
  busy.value = provider;
  try {
    await invoke("drop_provider", { provider });
    const rest = { ...models.value };
    delete rest[provider];
    models.value = rest;
    await loadProviders();
  } finally {
    busy.value = null;
  }
}

export async function loadModels(provider: string): Promise<void> {
  busy.value = provider;
  try {
    const found = await invoke<AgentModel[]>("list_provider_models", { provider });
    models.value = { ...models.value, [provider]: found };
  } finally {
    busy.value = null;
  }
}

export async function chooseAgent(provider: string, model: string): Promise<void> {
  await invoke("choose_agent", { provider, model });
  chosen.value = { provider, model };
}

export function isSetUp(provider: ProviderStatus): boolean {
  return provider.held === "keychain" || provider.added;
}

export function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function spellContext(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${Math.round(tokens / 100_000) / 10}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return String(tokens);
}

export function startProviders(): void {
  loadProviders().catch(complain);
}
