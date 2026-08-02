/**
 * The plan comparison matrix.
 *
 * The property under test is the one the page is built on: **a row means
 * the same thing in every column**. A card layout can get away with
 * per-tier wording because nobody reads two cards at once; a table
 * cannot, because the reader compares cells directly. So these tests
 * pin the pivot — same row key across tiers, cells in tier order — and
 * the two ways a cell can lie: an empty cell where a capability is
 * absent, and a row that appears at all when the server has no opinion
 * about it.
 */

import { describe, expect, it } from "vitest";

import { planMatrixGroups } from "../features/billing/planMatrix";
import { en } from "../i18n/locales/en";
import type { PlanTier } from "../services/billingApi";

const p = en.settings.planUsage;

/** The shape `GET /billing/plans/` actually returns, trimmed. */
const tier = (name: string, limits: Record<string, unknown>): PlanTier =>
    ({
        tier: name,
        price: null,
        purchasable: false,
        contact_sales: false,
        limits,
    }) as unknown as PlanTier;

const FREE = tier("free", {
    monthly_ai_credits: 5,
    message_retention_days: 180,
    agent_tool_level: "read",
    max_effort: "low",
    auto_effort: false,
    agent_memory: "none",
    agent_history_retention_days: 30,
    integrations: [],
    digest_cadence: null,
    task_create_monthly: 50,
    note_create_monthly: 50,
    upload_max_mb: 5,
});

const PRO = tier("pro", {
    monthly_ai_credits: 70,
    message_retention_days: null,
    agent_tool_level: "organize",
    max_effort: "high",
    auto_effort: true,
    agent_memory: "team",
    agent_history_retention_days: 365,
    integrations: ["web", "google_calendar", "github"],
    digest_cadence: "weekly",
    task_create_monthly: 500,
    note_create_monthly: 500,
    upload_max_mb: 50,
});

const flat = (tiers: PlanTier[]) =>
    planMatrixGroups(tiers, p, "en").flatMap((g) => g.rows.map((r) => [g.key, r] as const));

const rowByKey = (tiers: PlanTier[], key: string) => {
    const found = flat(tiers).find(([, r]) => r.key === key);
    if (!found) throw new Error(`no row ${key}`);
    return found[1];
};

describe("planMatrixGroups", () => {
    it("gives every row one cell per tier, in tier order", () => {
        const tiers = [FREE, PRO];
        for (const [, row] of flat(tiers)) {
            expect(row.cells, `row ${row.key}`).toHaveLength(tiers.length);
        }
        // Column order is positional — the page keys cells off
        // `tiers[i]`, so a reordering here would silently mislabel
        // every column rather than fail loudly.
        const credits = rowByKey(tiers, "credits");
        expect(credits.cells[0]).toMatchObject({ label: "5" });
        expect(credits.cells[1]).toMatchObject({ label: "70" });
    });

    it("labels a row once, not once per tier", () => {
        // The whole point of the pivot: Free and Pro disagree about the
        // VALUE of "what Genos does", never about the question.
        const agency = rowByKey([FREE, PRO], "agency");
        expect(agency.label).toBe(p.matrixRowAgency);
        expect(agency.cells[0]).toMatchObject({ label: p.matrixAgencyRead });
        expect(agency.cells[1]).toMatchObject({ label: p.matrixAgencyOrganize });
    });

    it("renders a missing integration as an explicit no, never a blank", () => {
        const github = rowByKey([FREE, PRO], "github");
        expect(github.cells[0]).toEqual({ kind: "no" });
        expect(github.cells[1]).toEqual({ kind: "yes" });
    });

    it("renders null as unlimited rather than as zero or empty", () => {
        const history = rowByKey([FREE, PRO], "history");
        expect(history.cells[0]).toMatchObject({ label: "180" });
        expect(history.cells[1]).toMatchObject({ label: p.matrixForever, emphasis: true });
    });

    it("calls depth adaptive only on top of the deepest rung", () => {
        const depth = (t: PlanTier) => rowByKey([t], "depth").cells[0];
        expect(depth(PRO)).toMatchObject({ label: p.matrixDepthAdaptive });
        // auto_effort alone must not claim it — the label would promise
        // tuning across a range the tier does not have.
        const autoButShallow = tier("x", { max_effort: "medium", auto_effort: true });
        expect(depth(autoButShallow)).toMatchObject({ label: p.matrixDepthThorough });
    });

    it("omits a row the server has no opinion about, rather than crossing it", () => {
        // A server predating the digest sends the key for nobody. A row
        // of crosses would advertise the absence of a feature that does
        // not exist yet.
        const old = tier("old", { monthly_ai_credits: 5, message_retention_days: 30 });
        expect(flat([old]).some(([, r]) => r.key === "digest")).toBe(false);
        expect(flat([FREE, PRO]).some(([, r]) => r.key === "digest")).toBe(true);
    });

    it("follows the server between the credits and daily-ask eras", () => {
        // Same switch `planBenefits` uses: whichever the server actually
        // enforces is the one that is true, and either side may deploy
        // first.
        const daily = tier("d", { llm_ask_daily: 20, message_retention_days: 30 });
        expect(flat([daily]).some(([, r]) => r.key === "asks")).toBe(true);
        expect(flat([daily]).some(([, r]) => r.key === "credits")).toBe(false);
        expect(flat([FREE]).some(([, r]) => r.key === "credits")).toBe(true);
        expect(flat([FREE]).some(([, r]) => r.key === "asks")).toBe(false);
    });

    it("stays permissive on an older server that gates nothing", () => {
        // Matches the server's dark-ship contract: if it does not send a
        // limit it is not enforcing one, so claiming the capability is
        // the truthful reading, not the generous one.
        const bare = tier("bare", { monthly_ai_credits: null, message_retention_days: null });
        expect(rowByKey([bare], "agency").cells[0]).toMatchObject({
            label: p.matrixAgencyOrganize,
        });
        expect(rowByKey([bare], "web").cells[0]).toEqual({ kind: "yes" });
    });

    it("never emits a row with an empty label", () => {
        // A missing i18n key would render a blank row header, which in a
        // grid reads as a rendering bug rather than a missing string.
        for (const group of planMatrixGroups([FREE, PRO], p, "en")) {
            expect(group.label.length).toBeGreaterThan(0);
            for (const row of group.rows) {
                expect(row.label.length, `row ${row.key}`).toBeGreaterThan(0);
                for (const cell of row.cells) {
                    if (cell.kind === "value") {
                        expect(cell.label.length, `cell in ${row.key}`).toBeGreaterThan(0);
                    }
                }
            }
        }
    });
});
