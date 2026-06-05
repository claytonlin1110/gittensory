import { describe, expect, it } from "vitest";
import {
  attachRecommendationSnapshot,
  recommendationSnapshotEnvelope,
  type RecommendationSnapshotEnvelope,
} from "../../src/services/recommendation-snapshots";
import type { AgentActionRecord, AgentContextSnapshotRecord } from "../../src/types";

/**
 * Issue #283: Lock down the public/private serialization contract for decision snapshots.
 *
 * These fixtures verify that the public-facing RecommendationSnapshotEnvelope never
 * carries private context fields regardless of what the underlying AgentContextSnapshotRecord
 * payload contains.
 */

const FORBIDDEN_PUBLIC_FIELDS =
  /wallet|hotkey|coldkey|mnemonic|seed phrase|raw trust|trust score|privateScoreability|private scoreability|private reviewability|reviewability internals|reward estimate|payout|farming|scoreability|recommendationEvidence|localSourceContent|local source|repoSignalSnapshotIds|scoringModelId/i;

// ── Public envelope has an exact, stable field set ─────────────────────────

const PUBLIC_ENVELOPE_KEYS: Array<keyof RecommendationSnapshotEnvelope> = [
  "kind",
  "version",
  "snapshotId",
  "contextSnapshotId",
  "actionId",
  "runId",
  "actionType",
  "generatedAt",
  "publicSafe",
  "target",
];

describe("public snapshot serialization — exact field contract", () => {
  it("envelope contains exactly the expected public-safe keys and no others", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), baseContext());
    const actualKeys = Object.keys(envelope).sort();
    expect(actualKeys).toEqual([...PUBLIC_ENVELOPE_KEYS].sort());
  });

  it("publicSafe is always true and cannot be omitted", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), baseContext());
    expect(envelope.publicSafe).toBe(true);
  });

  it("version is always 1", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), baseContext());
    expect(envelope.version).toBe(1);
  });

  it("kind is always recommendation_snapshot", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), baseContext());
    expect(envelope.kind).toBe("recommendation_snapshot");
  });
});

// ── Context payload never bleeds into the public envelope ──────────────────

describe("private context payload fields are fail-closed", () => {
  it("wallet field in context payload never appears in public envelope", () => {
    const ctx = baseContext({ payload: { wallet: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" } });
    expect(JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx))).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });

  it("hotkey field in context payload never appears in public envelope", () => {
    const ctx = baseContext({ payload: { hotkey: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" } });
    expect(JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx))).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });

  it("privateScoreability field in context payload never appears in public envelope", () => {
    const ctx = baseContext({ payload: { privateScoreability: "must-not-copy", rawTrustScore: 0.87 } });
    expect(JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx))).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });

  it("recommendationEvidence in context payload never appears in public envelope", () => {
    const ctx = baseContext({ payload: { recommendationEvidence: { raw: "internal-evidence", signals: ["sig1"] } } });
    expect(JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx))).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });

  it("local source content in context payload never appears in public envelope", () => {
    const ctx = baseContext({ payload: { localSourceContent: "// real source code here", diff: "--- a\n+++ b" } });
    expect(JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx))).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });

  it("repoSignalSnapshotIds are not copied from context to public envelope", () => {
    const ctx = baseContext({ repoSignalSnapshotIds: ["signal-abc-123", "signal-def-456"] });
    const serialized = JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx));
    expect(serialized).not.toContain("signal-abc-123");
    expect(serialized).not.toContain("repoSignalSnapshotIds");
  });

  it("scoringModelId is not copied from context to public envelope", () => {
    const ctx = baseContext({ scoringModelId: "internal-model-v7" });
    const serialized = JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx));
    expect(serialized).not.toContain("internal-model-v7");
    expect(serialized).not.toContain("scoringModelId");
  });

  it("freshnessWarnings are not copied from context to public envelope", () => {
    const ctx = baseContext({ freshnessWarnings: ["private-freshness-detail", "another-warning"] });
    const serialized = JSON.stringify(recommendationSnapshotEnvelope(baseAction(), ctx));
    expect(serialized).not.toContain("private-freshness-detail");
    expect(serialized).not.toContain("freshnessWarnings");
  });
});

// ── Fixture: mixed public action + heavily private context ─────────────────

describe("mixed snapshot — public action data plus private context", () => {
  const heavilyPrivateCtx = baseContext({
    scoringModelId: "scoring-model-v99",
    repoSignalSnapshotIds: ["snap-1", "snap-2", "snap-3"],
    freshnessWarnings: ["stale-reward-estimate", "raw-trust-signal-expired"],
    payload: {
      privateScoreability: "must-not-copy",
      recommendationEvidence: { raw: "internal", wallet: "5GrwEF" },
      hotkey: "5HHHH",
      localSourceContent: "export function secret() {}",
      rewardEstimate: 12.5,
      farmingScore: 0.93,
    },
  });

  it("envelope only exposes public action fields", () => {
    const envelope = recommendationSnapshotEnvelope(
      baseAction({ targetRepoFullName: "octo/demo", targetPullNumber: 42 }),
      heavilyPrivateCtx,
    );
    expect(envelope.target).toEqual({ repoFullName: "octo/demo", pullNumber: 42 });
    expect(envelope.actionType).toBe("choose_next_work");
    expect(envelope.publicSafe).toBe(true);
  });

  it("JSON serialization of the mixed snapshot is free of all forbidden content", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), heavilyPrivateCtx);
    expect(JSON.stringify(envelope)).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });

  it("attached action payload exposes only the snapshot id and envelope — not private context", () => {
    const attached = attachRecommendationSnapshot(
      baseAction({ payload: { publicDecision: "pursue" } }),
      heavilyPrivateCtx,
    );
    const serialized = JSON.stringify(attached.payload);
    expect(serialized).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
    expect(attached.payload.publicDecision).toBe("pursue");
    expect(typeof attached.payload.recommendationSnapshotId).toBe("string");
    expect(attached.payload.recommendationSnapshot).toBeTruthy();
  });
});

// ── Fixture: fresh evidence ────────────────────────────────────────────────

describe("fresh evidence snapshot", () => {
  const freshCtx = baseContext({
    decisionPackVersion: "2026-06-05T10:00:00.000Z",
    payload: { privateScoreability: "fresh-private-context" },
  });

  it("generatedAt reflects the decisionPackVersion timestamp", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), freshCtx);
    expect(envelope.generatedAt).toBe("2026-06-05T10:00:00.000Z");
  });

  it("envelope remains clean even with populated decisionPackVersion", () => {
    expect(JSON.stringify(recommendationSnapshotEnvelope(baseAction(), freshCtx))).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });
});

// ── Fixture: stale evidence ────────────────────────────────────────────────

describe("stale evidence snapshot — explicitly represented, not silently omitted", () => {
  const staleCtx = baseContext({
    decisionPackVersion: "2026-01-01T00:00:00.000Z",
    freshnessWarnings: ["decision-pack-stale:72h", "repo-signal-snapshot-stale"],
    payload: { privateScoreability: "stale-private-value" },
  });

  it("stale generatedAt is preserved in the public envelope", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), staleCtx);
    expect(envelope.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("stale freshness warnings do not appear in the public envelope", () => {
    const serialized = JSON.stringify(recommendationSnapshotEnvelope(baseAction(), staleCtx));
    expect(serialized).not.toContain("decision-pack-stale");
    expect(serialized).not.toContain("repo-signal-snapshot-stale");
    expect(serialized).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });
});

// ── Fixture: missing evidence ──────────────────────────────────────────────

describe("missing evidence snapshot — represented explicitly without leaking context", () => {
  const missingCtx = baseContext({
    decisionPackVersion: null,
    scoringModelId: null,
    repoSignalSnapshotIds: [],
    freshnessWarnings: [],
    payload: {},
  });

  it("generatedAt falls back to createdAt when decisionPackVersion is null", () => {
    const ctx = { ...missingCtx, createdAt: "2026-06-01T00:00:00.000Z" };
    const envelope = recommendationSnapshotEnvelope(baseAction(), ctx);
    expect(envelope.generatedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("generatedAt is null when both decisionPackVersion and createdAt are null", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), missingCtx);
    expect(envelope.generatedAt).toBeNull();
  });

  it("envelope with missing evidence is still clean", () => {
    expect(JSON.stringify(recommendationSnapshotEnvelope(baseAction(), missingCtx))).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });
});

// ── Fixture: private-only context (no action target) ──────────────────────

describe("private-only context snapshot — no public action target", () => {
  it("envelope target is empty when action has no repo/pr/issue target", () => {
    const envelope = recommendationSnapshotEnvelope(
      baseAction({ targetRepoFullName: null, targetPullNumber: null, targetIssueNumber: null }),
      baseContext(),
    );
    expect(envelope.target).toEqual({});
  });

  it("empty-target envelope is still public-safe", () => {
    const envelope = recommendationSnapshotEnvelope(
      baseAction({ targetRepoFullName: null, targetPullNumber: null, targetIssueNumber: null }),
      baseContext({ payload: { wallet: "5G...", hotkey: "5H..." } }),
    );
    expect(JSON.stringify(envelope)).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
  });
});

// ── API/MCP-facing serialization ───────────────────────────────────────────

describe("API/MCP-facing serialization scenarios", () => {
  it("round-trip JSON serialization produces identical envelope", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), baseContext());
    const roundTripped = JSON.parse(JSON.stringify(envelope)) as RecommendationSnapshotEnvelope;
    expect(roundTripped).toEqual(envelope);
  });

  it("serialized envelope satisfies publicSafe:true contract after JSON round-trip", () => {
    const envelope = recommendationSnapshotEnvelope(baseAction(), baseContext());
    const roundTripped = JSON.parse(JSON.stringify(envelope)) as RecommendationSnapshotEnvelope;
    expect(roundTripped.publicSafe).toBe(true);
  });

  it("multiple action types all produce forbidden-free public envelopes", () => {
    const actionTypes = [
      "choose_next_work",
      "explain_repo_fit",
      "cleanup_existing_prs",
      "explain_score_blockers",
    ] as const;
    for (const actionType of actionTypes) {
      const envelope = recommendationSnapshotEnvelope(
        baseAction({ actionType }),
        baseContext({ payload: { privateScoreability: "must-not-copy", hotkey: "5HHHH" } }),
      );
      expect(JSON.stringify(envelope)).not.toMatch(FORBIDDEN_PUBLIC_FIELDS);
    }
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function baseAction(overrides: Partial<AgentActionRecord> = {}): AgentActionRecord {
  return {
    id: "run-1:00:choose_next_work",
    runId: "run-1",
    actionType: "choose_next_work",
    targetRepoFullName: "octo/repo",
    targetPullNumber: 10,
    targetIssueNumber: null,
    status: "recommended",
    recommendation: "Pursue this PR.",
    why: ["Queue pressure is low."],
    blockedBy: [],
    publicSafeSummary: "Pursue this PR.",
    approvalRequired: true,
    safetyClass: "private",
    payload: {},
    createdAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

function baseContext(overrides: Partial<AgentContextSnapshotRecord> = {}): AgentContextSnapshotRecord {
  return {
    id: "context-fixture-001",
    runId: "run-1",
    decisionPackVersion: "2026-06-05T00:00:00.000Z",
    repoSignalSnapshotIds: [],
    scoringModelId: "scoring-v1",
    freshnessWarnings: [],
    payload: {},
    ...overrides,
  };
}
