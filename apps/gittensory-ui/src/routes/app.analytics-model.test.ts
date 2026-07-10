import { describe, expect, it } from "vitest";

import {
  ANALYTICS_WINDOW_OPTIONS,
  buildOperatorDashboardPath,
  isAnalyticsWindowDays,
  resolveAnalyticsWindowDays,
} from "./app.analytics-model";

describe("app.analytics-model (#2199)", () => {
  it("accepts exactly the supported 7/30/90 window set", () => {
    for (const days of ANALYTICS_WINDOW_OPTIONS) {
      expect(isAnalyticsWindowDays(days)).toBe(true);
    }
    expect(isAnalyticsWindowDays(45)).toBe(false);
    expect(isAnalyticsWindowDays("30")).toBe(false);
    expect(isAnalyticsWindowDays(undefined)).toBe(false);
    expect(isAnalyticsWindowDays(null)).toBe(false);
  });

  it("restores a valid persisted window as-is", () => {
    expect(resolveAnalyticsWindowDays(7)).toBe(7);
    expect(resolveAnalyticsWindowDays(30)).toBe(30);
  });

  it("falls back to the 90-day default for a missing or corrupted persisted value", () => {
    expect(resolveAnalyticsWindowDays(undefined)).toBe(90);
    expect(resolveAnalyticsWindowDays(45)).toBe(90);
    expect(resolveAnalyticsWindowDays("30")).toBe(90);
  });

  it("builds the operator-dashboard path with the days query param", () => {
    expect(buildOperatorDashboardPath(7)).toBe("/v1/app/operator-dashboard?days=7");
    expect(buildOperatorDashboardPath(90)).toBe("/v1/app/operator-dashboard?days=90");
  });
});
