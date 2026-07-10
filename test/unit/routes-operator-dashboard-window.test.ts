import { describe, expect, it } from "vitest";

import { createApp } from "../../src/api/routes";
import { createSessionForGitHubUser } from "../../src/auth/security";
import { createTestEnv } from "../helpers/d1";

// #2199: the analytics dashboard's 7/30/90-day window toggle re-parameterizes this route's `days` query param,
// which threads into buildOperatorDashboardPayload's shared analytics window (see test/unit/operator-dashboard.test.ts
// for the service-level threading assertion). This file covers the route's query validation and the
// query-string-to-service wiring end to end over HTTP.

describe("operator-dashboard analytics window query param (#2199)", () => {
  it("defaults to the 90-day window when no days param is given", async () => {
    const app = createApp();
    const env = createTestEnv({ PRODUCT_USAGE_HASH_SALT: "operator-dashboard-window-test-salt" });
    const { token } = await createSessionForGitHubUser(env, { login: "jsonbored", id: 1 });

    const res = await app.request("/v1/app/operator-dashboard", { headers: { cookie: `gittensory_session=${token}` } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ recommendationQuality: expect.objectContaining({ windowDays: 90 }) });
  });

  it("accepts a supported days value and threads it through to the window-scoped cards", async () => {
    const app = createApp();
    const env = createTestEnv({ PRODUCT_USAGE_HASH_SALT: "operator-dashboard-window-test-salt" });
    const { token } = await createSessionForGitHubUser(env, { login: "jsonbored", id: 1 });

    const res = await app.request(
      "/v1/app/operator-dashboard?days=30",
      { headers: { cookie: `gittensory_session=${token}` } },
      env,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ recommendationQuality: expect.objectContaining({ windowDays: 30 }) });
  });

  it("rejects an unsupported days value instead of silently coercing it", async () => {
    const app = createApp();
    const env = createTestEnv({ PRODUCT_USAGE_HASH_SALT: "operator-dashboard-window-test-salt" });
    const { token } = await createSessionForGitHubUser(env, { login: "jsonbored", id: 1 });

    const res = await app.request(
      "/v1/app/operator-dashboard?days=45",
      { headers: { cookie: `gittensory_session=${token}` } },
      env,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_query" });
  });
});
