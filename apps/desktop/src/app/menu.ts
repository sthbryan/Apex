import { listen } from "@tauri-apps/api/event";
import { run } from "@/app/commands";

export async function startMenu(): Promise<() => void> {
  return await listen<string>("menu", (event) => run(event.payload));
}
