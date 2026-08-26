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

export async function forgetKey(provider: string): Promise<void> {
  busy.value = provider;
  try {
    await invoke("forget_provider_key", { provider });
    models.value = { ...models.value, [provider]: [] };
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

export function holdsKey(provider: ProviderStatus): boolean {
  return provider.held !== null || provider.keyless;
}

export function startProviders(): void {
  loadProviders().catch(complain);
}
