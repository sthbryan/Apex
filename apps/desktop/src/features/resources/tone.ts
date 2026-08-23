import type { BarTone } from "@apex/ui";

export function barTone(percent: number): BarTone {
  if (percent >= 90) {
    return "failed";
  }
  if (percent >= 70) {
    return "blocked";
  }
  return "accent";
}
