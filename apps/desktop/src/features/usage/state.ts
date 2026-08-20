import { computed, signal } from "@preact/signals";

import { metrics } from "@/shared/telemetry";

export const usageOpen = signal(false);

export const hasUsage = computed(
  () =>
    (metrics.value?.quotas ?? []).some((report) => report.windows.length > 0) ||
    (metrics.value?.quota_failures ?? []).length > 0,
);

export const tightestUsage = computed(() => {
  const windows = (metrics.value?.quotas ?? []).flatMap((report) => report.windows);
  if (windows.length === 0) {
    return null;
  }
  return Math.max(...windows.map((window) => window.used_percent));
});

export const anyOverPace = computed(() =>
  (metrics.value?.quotas ?? [])
    .flatMap((report) => report.windows)
    .some((window) => window.lasts_to_reset === false),
);

export function toggleUsagePopover(): void {
  usageOpen.value = !usageOpen.value;
}
