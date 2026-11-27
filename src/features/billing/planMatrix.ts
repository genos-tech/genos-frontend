// The plan comparison MATRIX — every tier fact, pivoted so a feature is
// a row and a tier is a column.
//
// **The only plan renderer.** Both the public `/plans` page and the
// in-app `/workspace/plans` read from here. They used to have separate
// row builders — `planBenefits.ts` and `planComparisonRows.ts`, each
// emitting finished sentences per tier — under comments insisting the
// sharing was "the only thing keeping marketing and product honest".
// They drifted anyway, most visibly over MCP, which reached the
// marketing table and not the page the upgrade prompt sent people to.
// One renderer makes that class of bug unexpressible rather than
// merely tested for.
//
// The shape follows from the question. A card answers "what do I get on
// Pro?"; nobody arrives asking that. They ask "what does Pro give me
// that Core doesn't?" — which needs the same row across five columns,
// and a finished sentence per tier is exactly the wrong unit for a cell.
//
// **A row may never advertise something the server does not grant.**
// Everything here is derived from the `limits` object in
// `GET /billing/plans/`; a tier column is whatever the server said it
// was. The single exception is the premium-models row, and it says so
// at the point it breaks the rule.
//
// Missing keys (an older server) resolve permissive, matching the
// server's dark-ship contract — on such a server nothing is gated, so
// the permissive claim is also the truthful one.

import { fmt } from "../../i18n";
import type { Messages } from "../../i18n/types";
import type { HtmlPageLimits, PlanTier } from "../../services/billingApi";
import { storageLabel } from "./storageLabel";

type PlanStrings = Messages["settings"]["planUsage"];

/**
 * A cell is deliberately not just a string.
 *
 * "Unlimited" and "50" both belong in a numeric row but should not read
 * with equal weight, and an integration a tier lacks has to render as a
 * visible absence rather than an empty cell — an empty cell reads as
 * "we forgot", which is the failure the card layout already had. The
 * `kind` lets the page style each case without parsing the text back.
 */
export type MatrixCell =
    | { kind: "yes"; label?: string }
    | { kind: "no"; label?: string }
    | { kind: "value"; label: string; emphasis?: boolean };

export interface MatrixRow {
    key: string;
    /** Row header. */
    label: string;
    /** Small print under the header: what the number is counted against. Optional. */
    hint?: string;
    /** One cell per tier, in the order the tiers were passed in. */
    cells: MatrixCell[];
}

export interface MatrixGroup {
    key: string;
    label: string;
    rows: MatrixRow[];
}

const num = (v: number, locale: string) => v.toLocaleString(locale);

/**
 * Build every comparison group for the tiers the server returned.
 *
 * Takes ALL tiers at once rather than one at a time: a row only exists
 * if at least one tier has an opinion about it, and that is not knowable
 * from a single tier. A server that predates a
 * capability sends it for nobody, and the row should then not appear at
 * all rather than appear empty for everyone.
 */
export const planMatrixGroups = (
    tiers: PlanTier[],
    p: PlanStrings,
    locale: string
): MatrixGroup[] => {
    type Limits = PlanTier["limits"];
    const limits: Limits[] = tiers.map((t) => t.limits);
    const has = (key: keyof Limits) => limits.some((L) => L[key] !== undefined);

    /** A row whose cells are read straight off each tier's limits. */
    const row = (
        key: string,
        label: string,
        cell: (L: PlanTier["limits"]) => MatrixCell
    ): MatrixRow => ({ key, label, cells: limits.map(cell) });

    /**
     * A numeric allowance. `null` means unlimited throughout the limits
     * payload — and so does **absent**, which is the subtle one.
     *
     * `== null` rather than `=== null` deliberately, matching
     * the card builders this replaced: a key the server does not send is
     * a limit it is not enforcing, so the honest cell is "Unlimited". Splitting the
     * two and rendering a cross for `undefined` would put a dimmed "not
     * included" under every column of, say, "Tasks per month" on an
     * older server — reading as *this plan cannot create tasks*, which
     * is the exact inversion of what the silence means.
     *
     * Whether a row should EXIST at all is a separate question, asked
     * with `has()` at the call site.
     */
    const quota = (
        key: string,
        label: string,
        pick: (L: PlanTier["limits"]) => number | null | undefined,
        unlimited: string
    ) =>
        row(key, label, (L) => {
            const v = pick(L);
            if (v == null) return { kind: "value", label: unlimited, emphasis: true };
            return { kind: "value", label: num(v, locale) };
        });

    const groups: MatrixGroup[] = [];

    // ---- What Genos does for you --------------------------------
    const ai: MatrixRow[] = [];

    // Credits and the older daily-ask counter are two eras of the same
    // row, and which one the server enforces decides which is true. Same
    // same payload-shape convention the model picker uses, for the same
    // reason: either side can deploy first and the page still describes
    // what is actually enforced.
    if (has("monthly_ai_credits")) {
        ai.push(
            quota("credits", p.matrixRowCredits, (L) => L.monthly_ai_credits, p.matrixUnlimited)
        );
    } else {
        ai.push(quota("asks", p.matrixRowAsks, (L) => L.llm_ask_daily, p.matrixUnlimited));
    }

    ai.push(
        row("agency", p.matrixRowAgency, (L) => {
            const agency = L.agent_tool_level ?? "organize";
            return {
                kind: "value",
                label:
                    agency === "read"
                        ? p.matrixAgencyRead
                        : agency === "act"
                          ? p.matrixAgencyAct
                          : p.matrixAgencyOrganize,
                emphasis: agency === "organize",
            };
        }),
        row("depth", p.matrixRowDepth, (L) => {
            const depth = L.max_effort ?? "high";
            // "Adaptive" only reads truthfully on top of the deepest
            // rung, so it labels high+auto — never auto alone.
            const adaptive = (L.auto_effort ?? true) && depth === "high";
            return {
                kind: "value",
                label: adaptive
                    ? p.matrixDepthAdaptive
                    : depth === "low"
                      ? p.matrixDepthQuick
                      : depth === "medium"
                        ? p.matrixDepthThorough
                        : p.matrixDepthDeep,
                emphasis: adaptive,
            };
        }),
        row("memory", p.matrixRowMemory, (L) => {
            const memory = L.agent_memory ?? "team";
            return {
                kind: "value",
                label:
                    memory === "none"
                        ? p.matrixMemoryNone
                        : memory === "own"
                          ? p.matrixMemoryOwn
                          : p.matrixMemoryTeam,
                emphasis: memory === "team",
            };
        })
    );

    if (has("agent_history_retention_days")) {
        ai.push(
            quota(
                "genos-history",
                p.matrixRowGenosHistory,
                (L) => L.agent_history_retention_days,
                p.matrixUnlimited
            )
        );
    }

    // The ONE row not derived from `limits`, and the exception is worth
    // stating because the header above promises otherwise: premium model
    // access comes from `model_daily`, which `_PLAN_LIMIT_KEYS` leaves
    // out of the public payload on purpose (per-model caps churn with the
    // model catalog). So the frontend cannot read it, and keying on the
    // tier name is the only honest option left.
    //
    // Dropping the row instead is what the card layout's replacement did,
    // and it silently cost every paid plan a real selling point — Free
    // blocks opus-class models entirely.
    ai.push({
        key: "premium-models",
        label: p.matrixRowPremiumModels,
        cells: tiers.map((t) => (t.tier === "free" ? { kind: "no" } : { kind: "yes" })),
    });

    groups.push({ key: "ai", label: p.matrixGroupAi, rows: ai });

    // ---- Connected AI apps (MCP) --------------------------------
    // Its own group (MIP-1614): MCP is what Genos is reached THROUGH
    // (an outside AI app calling in), not what Genos reaches out to, and
    // since 2026-11-22 it carries real limits that a user can hit. They
    // are all read off the same `TIER_QUOTAS` the server enforces, so the
    // page can never promise a number the server does not apply.
    //
    // `has()` because a server predating the gate sends the key for
    // nobody, and a row of crosses would then advertise that no plan
    // includes a feature every plan actually had.
    //
    // A plan without MCP (Free) shows a cross on every number: a "None"
    // under "calls per day" would read as a limit rather than an absence.
    // `=== false`, not falsy: a server that predates `mcp_enabled` must
    // not turn its numbers into crosses.
    const mcpOn = (L: PlanTier["limits"]) => L.mcp_enabled !== false;
    const mcpRows: MatrixRow[] = [];
    if (has("mcp_enabled")) {
        mcpRows.push(
            row("mcp", p.matrixRowMcp, (L) => (L.mcp_enabled ? { kind: "yes" } : { kind: "no" }))
        );
    }
    const mcpCount = (
        key: string,
        label: string,
        limitKey: keyof PlanTier["limits"],
        hint?: string,
        // A number the server also caps for every plan (a transport throttle, a fixed bulk size, a
        // maximum page): "no plan limit" is then NOT "unlimited", and the contract plan, which has no
        // plan limit, is "Custom" rather than a promise the fixed cap would break.
        fixedCap = false
    ) => {
        if (!has(limitKey)) return;
        mcpRows.push({
            key,
            label,
            hint,
            cells: tiers.map((t): MatrixCell => {
                const L = t.limits;
                if (!mcpOn(L)) return { kind: "no" };
                const v = L[limitKey] as number | null | undefined;
                if (v != null) return { kind: "value", label: num(v, locale) };
                return fixedCap && t.tier === "enterprise"
                    ? { kind: "value", label: p.matrixCustom }
                    : { kind: "value", label: p.matrixUnlimited, emphasis: true };
            }),
        });
    };
    mcpCount("mcp-apps", p.matrixRowMcpApps, "mcp_max_connections", p.matrixHintMcpNewOnly);
    mcpCount("mcp-keys", p.matrixRowMcpKeys, "mcp_max_api_keys", p.matrixHintMcpNewOnly);
    mcpCount(
        "mcp-per-min",
        p.matrixRowMcpPerMin,
        "mcp_calls_per_min",
        p.matrixHintMcpPerMin,
        true
    );
    mcpCount("mcp-per-day", p.matrixRowMcpPerDay, "mcp_calls_per_day", p.matrixHintMcpPerDay);
    mcpCount("mcp-bulk", p.matrixRowMcpBulk, "mcp_bulk_max_tasks", undefined, true);
    mcpCount("mcp-plan", p.matrixRowMcpPlan, "mcp_bulk_max_plan_tasks", undefined, true);
    mcpCount("mcp-page", p.matrixRowMcpPage, "mcp_list_page_max", undefined, true);
    // A search from a connected AI app is a billable AI surface (credit_policy.yaml, `mcp_search`),
    // so the row exists only when credits are the limit the server enforces, the same switch the
    // credits row uses. Unlimited credits (Enterprise) = no spend to warn about.
    if (has("mcp_enabled") && has("monthly_ai_credits")) {
        mcpRows.push(
            row("mcp-search", p.matrixRowMcpSearch, (L) =>
                !mcpOn(L)
                    ? { kind: "no" }
                    : L.monthly_ai_credits == null
                      ? { kind: "value", label: p.matrixUnlimited, emphasis: true }
                      : { kind: "value", label: p.matrixMcpSearchCredits }
            )
        );
    }
    if (mcpRows.length) groups.push({ key: "mcp", label: p.matrixGroupMcp, rows: mcpRows });

    // ---- What it can reach --------------------------------------
    // These are the natural yes/no rows: you either get the integration
    // or you don't, and a cross here is information rather than a gap.
    const reach = (key: string, label: string, id: string) =>
        row(key, label, (L) => {
            const enabled = new Set(L.integrations ?? ["web", "google_calendar", "github"]);
            return enabled.has(id) ? { kind: "yes" } : { kind: "no" };
        });

    groups.push({
        key: "reach",
        label: p.matrixGroupReach,
        rows: [
            reach("web", p.matrixRowWeb, "web"),
            reach("google_calendar", p.matrixRowCalendar, "google_calendar"),
            reach("github", p.matrixRowGithub, "github"),
        ],
    });

    // ---- The workspace itself -----------------------------------
    const workspace: MatrixRow[] = [
        quota("history", p.matrixRowHistory, (L) => L.message_retention_days, p.matrixForever),
        quota("tasks", p.matrixRowTasks, (L) => L.task_create_monthly, p.matrixUnlimited),
        quota("notes", p.matrixRowNotes, (L) => L.note_create_monthly, p.matrixUnlimited),
    ];
    if (has("upload_max_mb")) {
        workspace.push(
            row("upload", p.matrixRowUpload, (L) =>
                L.upload_max_mb == null
                    ? { kind: "value", label: p.matrixUnlimited, emphasis: true }
                    : { kind: "value", label: fmt(p.matrixMb, { mb: String(L.upload_max_mb) }) }
            )
        );
    }
    // HTML pages: the count (never limited), then three numbers off the api's one HTML table. A plan
    // without them (Free, `null`) is a cross on every row, never "0" or "Unlimited". `has()` because
    // a server that predates the key sends it for nobody and the rows should then not exist.
    if (has("html_pages")) {
        const html = (
            key: string,
            label: string,
            cell: (h: HtmlPageLimits) => MatrixCell,
            hint?: string
        ) =>
            workspace.push({
                ...row(key, label, (L) => (L.html_pages ? cell(L.html_pages) : { kind: "no" })),
                hint,
            });
        const value = (text: string): MatrixCell => ({ kind: "value", label: text });
        html("html-pages", p.matrixRowHtmlPages, () => ({
            kind: "value",
            label: p.matrixUnlimited,
            emphasis: true,
        }));
        html("html-size", p.matrixRowHtmlSize, (h) => value(storageLabel(h.max_bytes, p, locale)));
        html(
            "html-storage",
            p.matrixRowHtmlStorage,
            (h) => value(storageLabel(h.max_storage_bytes, p, locale)),
            p.matrixHintHtmlStorage
        );
        html(
            "html-saves",
            p.matrixRowHtmlSaves,
            (h) => value(num(h.saves_per_hour, locale)),
            p.matrixHintPerPerson
        );
    }
    groups.push({ key: "workspace", label: p.matrixGroupWorkspace, rows: workspace });

    // ---- Automation: webhooks and scheduled reports --------------
    // Counts, where 0 is "not on this plan" (a cross, not a "0"), null is unlimited. The webhook cap
    // is per TEAM (the team's own plan decides), the report cap per person; the hint says which.
    const automation: MatrixRow[] = [];
    const count = (
        key: string,
        label: string,
        limitKey: "webhooks_max" | "schedules_max",
        hint: string
    ) => {
        if (!has(limitKey)) return;
        automation.push({
            ...row(key, label, (L) => {
                const v = L[limitKey];
                if (v === 0) return { kind: "no" };
                return v == null
                    ? { kind: "value", label: p.matrixUnlimited, emphasis: true }
                    : { kind: "value", label: num(v, locale) };
            }),
            hint,
        });
    };
    count("webhooks", p.matrixRowWebhooks, "webhooks_max", p.matrixHintPerTeam);
    count("schedules", p.matrixRowSchedules, "schedules_max", p.matrixHintPerPerson);
    if (automation.length) {
        groups.push({ key: "automation", label: p.matrixGroupAutomation, rows: automation });
    }

    return groups;
};
