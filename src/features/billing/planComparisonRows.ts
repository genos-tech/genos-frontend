// The capability rows on a plan card — the UX tier model's experience
// ladder (what Genos does / how deeply it thinks / what it remembers /
// what it can see / whether it comes to you), rendered ABOVE the
// fair-use rows from `planBenefits.ts`.
//
// ONE implementation, now serving the IN-APP plans page (`PlansHome`);
// the marketing page renders the same facts as a comparison table via
// `planMatrix.ts`. Fed by the tier config from `GET /billing/plans/`,
// so a card can never advertise a capability the server doesn't grant —
// which is the property that actually keeps marketing and product
// honest, and the one both modules share.
//
// Two rendering rules the pages must honour:
//   * `included: false` renders an EXPLICIT cross — never drop the
//     row. A missing capability silently omitted makes Free's card
//     look identical to Core's on exactly the rows that separate them.
//   * Value rows (agency / depth / memory) are always `included`; the
//     DIFFERENCE is the label, mirroring the tier table's wording.
//
// Missing keys (an older server) resolve permissive, matching the
// server's own dark-ship contract — on such a server nothing is gated,
// so the permissive claim is also the truthful one.

import { fmt } from "../../i18n";
import type { Messages } from "../../i18n/types";
import type { PlanTier } from "../../services/billingApi";

type PlanStrings = Messages["settings"]["planUsage"];

export interface PlanCapabilityRow {
    key: string;
    label: string;
    /** false ⇒ render an explicit cross (dimmed row), never omit. */
    included: boolean;
}

export const planCapabilityRows = (tier: PlanTier, p: PlanStrings): PlanCapabilityRow[] => {
    const L = tier.limits;
    const rows: PlanCapabilityRow[] = [];

    // What Genos does (the agency ladder).
    const agency = L.agent_tool_level ?? "organize";
    rows.push({
        key: "agency",
        label:
            agency === "read"
                ? p.capAgencyRead
                : agency === "act"
                  ? p.capAgencyAct
                  : p.capAgencyOrganize,
        included: true,
    });

    // How deeply it thinks. "Adaptive" only reads truthfully on top of
    // the deepest rung, so it labels high+auto, not auto alone.
    const depth = L.max_effort ?? "high";
    const adaptive = (L.auto_effort ?? true) && depth === "high";
    rows.push({
        key: "depth",
        label: adaptive
            ? p.capDepthAdaptive
            : depth === "low"
              ? p.capDepthQuick
              : depth === "medium"
                ? p.capDepthThorough
                : p.capDepthDeep,
        included: true,
    });

    // What it remembers.
    const memory = L.agent_memory ?? "team";
    rows.push({
        key: "memory",
        label:
            memory === "none"
                ? p.capMemoryNone
                : memory === "own"
                  ? p.capMemoryOwn
                  : p.capMemoryTeam,
        included: true,
    });
    if (L.agent_history_retention_days !== undefined) {
        rows.push({
            key: "genos-history",
            label:
                L.agent_history_retention_days == null
                    ? p.capGenosHistoryUnlimited
                    : fmt(p.capGenosHistoryDays, {
                          days: String(L.agent_history_retention_days),
                      }),
            included: true,
        });
    }

    // What it can see — the natural cross rows.
    const integrations = new Set(L.integrations ?? ["web", "google_calendar", "github"]);
    rows.push(
        { key: "web", label: p.capReachWeb, included: integrations.has("web") },
        {
            key: "google_calendar",
            label: p.capReachCalendar,
            included: integrations.has("google_calendar"),
        },
        { key: "github", label: p.capReachGithub, included: integrations.has("github") }
    );

    // Comes to you. Absent key = a server that predates the digest —
    // the one row we SKIP rather than cross, because a cross would
    // advertise the absence of a feature the product doesn't have yet.
    if (L.digest_cadence !== undefined) {
        rows.push({
            key: "digest",
            label:
                L.digest_cadence === "daily"
                    ? p.capDigestDaily
                    : L.digest_cadence === "weekly"
                      ? p.capDigestWeekly
                      : p.capDigestNone,
            included: L.digest_cadence != null,
        });
    }

    return rows;
};
