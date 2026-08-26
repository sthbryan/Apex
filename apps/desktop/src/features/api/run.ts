import type { ApiRun } from "@/bindings/ApiRun";
import { laidOut } from "@/features/api/body";
import type { Pair } from "@/features/api/url";

export interface Shown {
  text: string;
  json: boolean;
}

export function runHeaders(run: ApiRun): Pair[] {
  return run.headers.map(([key, value]) => ({ key, value }));
}

export function shownBody(run: ApiRun): Shown {
  if (run.truncated) {
    return { text: `${run.body}\n\n...`, json: false };
  }
  const laid = laidOut(run.body);
  return laid === null ? { text: run.body, json: false } : { text: laid, json: true };
}
