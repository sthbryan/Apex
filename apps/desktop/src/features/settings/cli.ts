import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

export type CliState = {
  path: string;
  linked: boolean;
  occupied: boolean;
  on_path: boolean;
};

export const cli = signal<CliState | null>(null);
export const cliBusy = signal(false);
export const cliError = signal<string | null>(null);

export async function loadCli(): Promise<void> {
  await settle("cli_state");
}

export async function installCli(): Promise<void> {
  await settle("link_cli");
}

export async function removeCli(): Promise<void> {
  await settle("unlink_cli");
}

async function settle(command: string): Promise<void> {
  cliBusy.value = true;
  cliError.value = null;
  try {
    cli.value = await invoke<CliState>(command);
  } catch (error) {
    cliError.value = String(error);
  } finally {
    cliBusy.value = false;
  }
}
