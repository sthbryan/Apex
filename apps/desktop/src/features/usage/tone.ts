import type { BarTone, ReadoutTone } from "@apex/ui";

export function barTone(percent: number): BarTone {
  if (percent >= 90) {
    return "failed";
  }
  if (percent >= 70) {
    return "blocked";
  }
  return "accent";
}

export function readoutTone(percent: number): ReadoutTone {
  if (percent >= 90) {
    return "failed";
  }
  if (percent >= 70) {
    return "blocked";
  }
  return "done";
}
