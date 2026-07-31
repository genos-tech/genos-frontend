/**
 * The capability rows on a plan card (UX tier model).
 *
 * Two properties are load-bearing:
 *   * a capability a tier lacks renders as an EXPLICIT cross
 *     (`included: false`) — never a silently shorter list, or Free's
 *     card looks identical to Core's on exactly the rows that
 *     separate them;
 *   * missing keys (older server) resolve PERMISSIVE, mirroring the
 *     server's dark-ship contract — on such a server nothing is
 *     gated, so the permissive claim is also the truthful one.
 */

import { describe, expect, it } from "vitest";

import { planCapabilityRows } from "../features/billing/planComparisonRows";
import { en } from "../i18n/locales/en";
import type { PlanTier } from "../services/billingApi";

const p = en.settings.planUsage;

const tier = (over: Partial<PlanTier["limits"]> = {}, t: PlanTier["tier"] = "pro"): PlanTier => ({
    tier: t,
    price: { amount: 2000, currency: "usd", interval: "month" },
    purchasable: true,
    contact_sales: false,
    limits: {
        llm_ask_daily: 250,
        web_search_daily: 60,
        task_create_monthly: 1500,
        note_create_monthly: 1000,
        message_retention_days: null,
        upload_max_mb: 50,
        ...over,
    },
});

const byKey = (t: PlanTier) => Object.fromEntries(planCapabilityRows(t, p).map((r) => [r.key, r]));

describe("planCapabilityRows — permissive / older-server payload", () => {
    it("claims the full experience and skips only the digest row", () => {
        const rows = byKey(tier());
        expect(rows.agency.label).toBe(p.capAgencyOrganize);
        expect(rows.depth.label).toBe(p.capDepthAdaptive);
        expect(rows.memory.label).toBe(p.capMemoryTeam);
        for (const key of ["web", "google_calendar", "github"]) {
            expect(rows[key].included).toBe(true);
        }
        // No digest_cadence key at all = a server that predates the
        // digest — no row, because a cross would advertise the absence
        // of a feature the product doesn't have yet.
        expect(rows.digest).toBeUndefined();
        expect(rows["genos-history"]).toBeUndefined();
    });
});

describe("planCapabilityRows — a flipped Free tier", () => {
    const free = tier(
        {
            agent_tool_level: "read",
            max_effort: "low",
            auto_effort: false,
            agent_memory: "none",
            agent_history_retention_days: 30,
            integrations: [],
            digest_cadence: null,
        },
        "free"
    );

    it("tells the read/quick/this-conversation story", () => {
        const rows = byKey(free);
        expect(rows.agency.label).toBe(p.capAgencyRead);
        expect(rows.depth.label).toBe(p.capDepthQuick);
        expect(rows.memory.label).toBe(p.capMemoryNone);
        expect(rows["genos-history"].label).toContain("30");
    });

    it("keeps every missing capability as an explicit cross", () => {
        const rows = byKey(free);
        for (const key of ["web", "google_calendar", "github", "digest"]) {
            expect(rows[key].included).toBe(false);
        }
        // The cross rows must not shrink the list: Free and a full
        // tier render the same row COUNT once both serve the digest key.
        const full = tier({
            agent_tool_level: "organize",
            max_effort: "high",
            auto_effort: true,
            agent_memory: "team",
            agent_history_retention_days: null,
            integrations: ["web", "google_calendar", "github"],
            digest_cadence: "daily",
        });
        expect(planCapabilityRows(free, p)).toHaveLength(planCapabilityRows(full, p).length);
    });
});

describe("planCapabilityRows — ladder labels", () => {
    it("labels each cadence distinctly", () => {
        expect(byKey(tier({ digest_cadence: "weekly" })).digest.label).toBe(p.capDigestWeekly);
        expect(byKey(tier({ digest_cadence: "daily" })).digest.label).toBe(p.capDigestDaily);
    });

    it("adaptive labels only the deepest rung", () => {
        // medium + auto must NOT read as "adaptive deep reasoning".
        const rows = byKey(tier({ max_effort: "medium", auto_effort: true }));
        expect(rows.depth.label).toBe(p.capDepthThorough);
    });

    it("partial integrations cross only the missing connector", () => {
        const rows = byKey(tier({ integrations: ["web", "google_calendar"] }));
        expect(rows.web.included).toBe(true);
        expect(rows.google_calendar.included).toBe(true);
        expect(rows.github.included).toBe(false);
    });
});
