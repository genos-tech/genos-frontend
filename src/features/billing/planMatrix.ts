// The plan comparison MATRIX — the same tier facts as the card rows,
// pivoted so a feature is a row and a tier is a column.
//
// Why a second shape and not a second source: a card answers "what do I
// get on Pro?", which is why `planBenefits.ts` and `planComparisonRows.ts`
// return a flat list of finished sentences per tier. It cannot answer
// "what does Pro give me that Core doesn't?" — for that the reader needs
// the same row across five columns, and a finished sentence per tier is
// exactly the wrong unit. So this module keeps the identical limit
// vocabulary and emits `(rowKey, per-tier cell)` instead.
//
// The one rule inherited from its siblings, and the reason all three
// live together: **a row may never advertise something the server does
// not grant.** Everything here is derived from the `limits` object in
// `GET /billing/plans/`; nothing is hardcoded per tier. A tier column is
// whatever the server said it was.
//
// Missing keys (an older server) resolve permissive, matching the
// server's dark-ship contract — on such a server nothing is gated, so
// the permissive claim is also the truthful one.

import { fmt } from "../../i18n";
import type { Messages } from "../../i18n/types";
import type { PlanTier } from "../../services/billingApi";

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
 * from a single tier. `digest_cadence` is the live example — a server
 * that predates the digest sends it for nobody, and the row should then
 * not appear at all rather than appear empty for everyone.
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
     * `planBenefits`: a key the server does not send is a limit it is
     * not enforcing, so the honest cell is "Unlimited". Splitting the
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
    // switch `planBenefits` uses, for the same reason: either side can
    // deploy first and the page still describes what is enforced.
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

    // Absent for every tier = a server that predates the digest. Skipped
    // entirely rather than shown as a row of crosses, which would
    // advertise the absence of a feature the product does not have yet.
    if (has("digest_cadence")) {
        ai.push(
            row("digest", p.matrixRowDigest, (L) => {
                const cadence = L.digest_cadence;
                if (cadence == null) return { kind: "no" };
                return {
                    kind: "value",
                    label: cadence === "daily" ? p.matrixDigestDaily : p.matrixDigestWeekly,
                    emphasis: cadence === "daily",
                };
            })
        );
    }

    // MCP sits in the AI group rather than under "what Genos can
    // reach": those rows are what Genos reaches OUT to, and this is an
    // outside agent reaching in. It is still an AI capability, and that
    // is how a reader looks for it.
    //
    // `has()` because a server predating the gate sends the key for
    // nobody, and a row of crosses would then advertise that no plan
    // includes a feature every plan actually had.
    if (has("mcp_enabled")) {
        ai.push(
            row("mcp", p.matrixRowMcp, (L) => (L.mcp_enabled ? { kind: "yes" } : { kind: "no" }))
        );
    }

    groups.push({ key: "ai", label: p.matrixGroupAi, rows: ai });

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
    groups.push({ key: "workspace", label: p.matrixGroupWorkspace, rows: workspace });

    return groups;
};
