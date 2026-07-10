// Analytics dashboard time-window toggle (#2199): the operator-dashboard route's previously-fixed 90-day
// analytics window (recommendation quality / fleet / gate-eval / cycle-time cards) becomes caller-selectable
// via this fixed 7/30/90-day set, persisted across visits through localStorage.

export const ANALYTICS_WINDOW_OPTIONS = [7, 30, 90] as const;
export type AnalyticsWindowDays = (typeof ANALYTICS_WINDOW_OPTIONS)[number];

export const ANALYTICS_WINDOW_STORAGE_KEY = "gittensory.analytics.windowDays";

const ANALYTICS_WINDOW_SET: ReadonlySet<number> = new Set(ANALYTICS_WINDOW_OPTIONS);

export function isAnalyticsWindowDays(value: unknown): value is AnalyticsWindowDays {
  return typeof value === "number" && ANALYTICS_WINDOW_SET.has(value);
}

/** Narrows an untrusted localStorage read to a supported window, falling back to the 90-day default for a
 *  fresh install or stale/corrupted stored data rather than sending an invalid `days` value to the API. */
export function resolveAnalyticsWindowDays(stored: unknown): AnalyticsWindowDays {
  return isAnalyticsWindowDays(stored) ? stored : 90;
}

export function buildOperatorDashboardPath(days: AnalyticsWindowDays): string {
  return `/v1/app/operator-dashboard?days=${days}`;
}
