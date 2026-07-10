import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/request", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock("@/lib/api/origin", () => ({ getApiOrigin: () => "https://api.test" }));

import { ANALYTICS_WINDOW_STORAGE_KEY } from "./app.analytics-model";
import { ProductAnalytics, type OperatorDashboard } from "./app.analytics";

const MINIMAL_DASHBOARD: OperatorDashboard = {
  metrics: [{ label: "Active sessions", value: "3", delta: "browser + CLI/MCP" }],
  noiseReduction: [],
};

describe("ProductAnalytics time-window toggle (#2199)", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ ok: true, data: MINIMAL_DASHBOARD });
    window.localStorage.clear();
  });

  it("defaults to the 90-day window on a fresh install (no persisted value)", async () => {
    render(<ProductAnalytics />);
    await screen.findByText("Active sessions");
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "https://api.test/v1/app/operator-dashboard?days=90",
        expect.any(Object),
      ),
    );
    expect(screen.getByRole("radio", { name: "90 day window" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("restores a valid persisted window instead of the default", async () => {
    window.localStorage.setItem(ANALYTICS_WINDOW_STORAGE_KEY, "30");
    render(<ProductAnalytics />);
    await screen.findByText("Active sessions");
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "https://api.test/v1/app/operator-dashboard?days=30",
        expect.any(Object),
      ),
    );
  });

  it("falls back to the 90-day default when the persisted value is corrupted/unsupported", async () => {
    window.localStorage.setItem(ANALYTICS_WINDOW_STORAGE_KEY, "45");
    render(<ProductAnalytics />);
    await screen.findByText("Active sessions");
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "https://api.test/v1/app/operator-dashboard?days=90",
        expect.any(Object),
      ),
    );
  });

  it("switching windows re-keys the fetch and persists the new choice", async () => {
    render(<ProductAnalytics />);
    await screen.findByText("Active sessions");
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "https://api.test/v1/app/operator-dashboard?days=90",
        expect.any(Object),
      ),
    );

    apiFetch.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: "7 day window" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "https://api.test/v1/app/operator-dashboard?days=7",
        expect.any(Object),
      ),
    );
    expect(window.localStorage.getItem(ANALYTICS_WINDOW_STORAGE_KEY)).toBe("7");
  });
});
