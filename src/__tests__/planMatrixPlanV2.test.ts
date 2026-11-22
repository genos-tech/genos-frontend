/**
 * The tier plan v2 rows of the plan table (MIP-1614): connected AI apps (MCP) limits, webhooks and
 * scheduled reports.
 *
 * The table is built from the limits the public plans endpoint serves, which come from the server's
 * `TIER_QUOTAS`. The fixture below is a copy of that payload (see its `_comment` for the source of
 * truth and where it is pinned on the api side). This test pins what the page SHOWS for it, so the
 * page cannot drift from the numbers Ken adopted on 2026-11-22: change a number in `TIER_QUOTAS`,
 * the fixture and this table together, or this fails.
 */

import { describe, expect, it } from "vitest";

import { planMatrixGroups, type MatrixCell } from "../features/billing/planMatrix";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import type { PlanTier } from "../services/billingApi";
import payload from "./fixtures/plansPayloadTierPlanV2.json";

const p = en.settings.planUsage;

const tiers = payload.tiers.map((t) => ({
    tier: t.tier,
    price: null,
    purchasable: false,
    contact_sales: t.tier === "enterprise",
    limits: t.limits,
})) as unknown as PlanTier[];

const text = (c: MatrixCell): string =>
    c.kind === "yes" ? "yes" : c.kind === "no" ? "no" : c.label;

/** What the page shows for one row: one string per tier, in tier order (free..enterprise). */
const shown = (groups: ReturnType<typeof planMatrixGroups>, key: string) => {
    const row = groups.flatMap((g) => g.rows).find((r) => r.key === key);
    if (!row) throw new Error(`no row ${key}`);
    return row.cells.map(text);
};

describe("plan table, tier plan v2 rows (MIP-1614)", () => {
    const groups = planMatrixGroups(tiers, p, "en");

    // [row key, free, core, pro, max, enterprise] — the numbers of genos-docs SUBSCRIPTION_TIERS.md.
    const expected: Array<[string, string[]]> = [
        ["mcp", ["no", "yes", "yes", "yes", "yes"]],
        ["mcp-apps", ["no", "3", "10", "25", "Unlimited"]],
        ["mcp-keys", ["no", "3", "10", "25", "Unlimited"]],
        ["mcp-per-min", ["no", "60", "120", "240", "Custom"]],
        ["mcp-per-day", ["no", "3,000", "10,000", "30,000", "Unlimited"]],
        ["mcp-bulk", ["no", "10", "30", "30", "Custom"]],
        ["mcp-plan", ["no", "10", "20", "20", "Custom"]],
        ["mcp-page", ["no", "50", "100", "100", "Custom"]],
        [
            "mcp-search",
            ["no", "Uses AI credits", "Uses AI credits", "Uses AI credits", "Unlimited"],
        ],
        ["webhooks", ["no", "3", "10", "25", "Unlimited"]],
        ["schedules", ["no", "5", "20", "20", "20"]],
    ];

    it.each(expected)("shows %s as the adopted numbers", (key, cells) => {
        expect(shown(groups, key)).toEqual(cells);
    });

    it("groups the MCP rows under one heading and the counts under Automation", () => {
        const mcp = groups.find((g) => g.key === "mcp");
        expect(mcp?.label).toBe("Connected AI apps (MCP)");
        expect(mcp?.rows.map((r) => r.key)).toEqual([
            "mcp",
            "mcp-apps",
            "mcp-keys",
            "mcp-per-min",
            "mcp-per-day",
            "mcp-bulk",
            "mcp-plan",
            "mcp-page",
            "mcp-search",
        ]);
        expect(groups.find((g) => g.key === "automation")?.rows.map((r) => r.key)).toEqual([
            "webhooks",
            "schedules",
        ]);
    });

    it("puts what a number is counted against in the small print", () => {
        const rows = groups.flatMap((g) => g.rows);
        const hint = (key: string) => rows.find((r) => r.key === key)?.hint;
        expect(hint("mcp-per-min")).toBe("For each key or connected app");
        expect(hint("mcp-per-day")).toBe("Per person, across all keys and apps");
        expect(hint("webhooks")).toBe("Per team");
        expect(hint("schedules")).toBe("Per person");
    });

    it("calls only the contract plan Custom on a row the server also caps for everyone", () => {
        // A paid tier with no plan limit (limits not enforced yet) is still capped by the server's fixed
        // sizes, but it is not a contract: it reads Unlimited like every other unset number.
        const unset = payload.tiers.map((t) =>
            t.tier === "pro"
                ? {
                      ...t,
                      limits: { ...t.limits, mcp_bulk_max_tasks: null, mcp_calls_per_min: null },
                  }
                : t
        ) as unknown as PlanTier[];
        const g = planMatrixGroups(unset, p, "en");
        expect(shown(g, "mcp-bulk")).toEqual(["no", "10", "Unlimited", "30", "Custom"]);
        expect(shown(g, "mcp-per-min")).toEqual(["no", "60", "Unlimited", "240", "Custom"]);
    });

    it("says nothing about the decommissioned digest", () => {
        const all = groups
            .flatMap((g) => [g.label, ...g.rows.flatMap((r) => [r.label, r.hint ?? ""])])
            .join(" ")
            .toLowerCase();
        expect(all).not.toContain("digest");
    });

    it("leaves the search row out when credits are not what the server enforces", () => {
        const noCredits = payload.tiers.map((t) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { monthly_ai_credits, ...rest } = t.limits;
            return { ...t, limits: { ...rest, llm_ask_daily: 20 } };
        }) as unknown as PlanTier[];
        const g = planMatrixGroups(noCredits, p, "en");
        expect(g.flatMap((x) => x.rows).some((r) => r.key === "mcp-search")).toBe(false);
        // The numbers are not credit-dependent and stay.
        expect(shown(g, "mcp-per-day")).toEqual(["no", "3,000", "10,000", "30,000", "Unlimited"]);
    });

    it("leaves every new row out for a server that does not send the keys", () => {
        const KEYS = [
            "webhooks_max",
            "schedules_max",
            "mcp_calls_per_min",
            "mcp_calls_per_day",
            "mcp_max_api_keys",
            "mcp_max_connections",
            "mcp_bulk_max_tasks",
            "mcp_bulk_max_plan_tasks",
            "mcp_list_page_max",
        ];
        const old = payload.tiers.map((t) => ({
            ...t,
            limits: Object.fromEntries(
                Object.entries(t.limits).filter(([k]) => !KEYS.includes(k))
            ),
        })) as unknown as PlanTier[];
        const g = planMatrixGroups(old, p, "en");
        const keys = g.flatMap((x) => x.rows.map((r) => r.key));
        for (const k of [
            "mcp-apps",
            "mcp-keys",
            "mcp-per-min",
            "mcp-per-day",
            "mcp-bulk",
            "mcp-plan",
            "mcp-page",
            "webhooks",
            "schedules",
        ]) {
            expect(keys, k).not.toContain(k);
        }
        expect(g.some((x) => x.key === "automation")).toBe(false);
        // The yes/no MCP row and the credits row still come from the keys the old server had.
        expect(keys).toContain("mcp");
    });

    it("uses localized strings: Japanese has no English left in the new rows", () => {
        const jp = planMatrixGroups(tiers, ja.settings?.planUsage as typeof p, "ja");
        const mcp = jp.find((g) => g.key === "mcp");
        expect(mcp?.label).toBe("接続した AI アプリ (MCP)");
        expect(shown(jp, "mcp-per-day")[1]).toBe("3,000");
        expect(shown(jp, "webhooks")[0]).toBe("no");
    });
});
