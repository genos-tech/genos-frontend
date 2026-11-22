import { agentKindOf, familyKind } from "../components/dashboard/agentActivity/agentActivityLinks";
import {
    AgentKind,
    AgentWorkConnection,
    AgentWorkGroup,
    AgentWorkItem,
    AgentWorkSession,
} from "../services/loadAgentWork";

/**
 * Pure helpers of the Sessions view and the app strip (MIP-2003). The sessions block of
 * `GET /api/v2/agent/work/` holds counts only (genos-api `services/agent_sessions`), so
 * everything here is arithmetic on those counts; no text is read or shown.
 */

/** A change row belongs to a session when it is the same app and falls inside the run's time
 *  span (plus a minute of slack: a write is logged just before its activity row). The run's item
 *  list is cut to ten and a note's id is spelled differently in the two sources, so ids are not
 *  compared. */
const SLACK_MS = 60_000;

export const sessionMatchesItem = (session: AgentWorkSession, item: AgentWorkItem): boolean => {
    if (agentKindOf(item.agent) !== session.agent) return false;
    const at = Date.parse(item.at);
    const from = Date.parse(session.started_at ?? "");
    const to = Date.parse(session.ended_at ?? "");
    if (Number.isNaN(at) || Number.isNaN(from) || Number.isNaN(to)) return false;
    return at >= from - SLACK_MS && at <= to + SLACK_MS;
};

/** The change groups narrowed to one session's rows. A group left empty drops out and a group's
 *  count is the number of rows it shows. */
export const groupsForSession = (
    groups: AgentWorkGroup[],
    session: AgentWorkSession
): AgentWorkGroup[] =>
    groups
        .map((group) => {
            const items = group.items.filter((item) => sessionMatchesItem(session, item));
            return { ...group, counts: { ...group.counts, total: items.length }, items };
        })
        .filter((group) => group.items.length > 0);

export const refusedOrFailed = (session: AgentWorkSession): number =>
    session.refused + session.failed;

export type AppStripRow = {
    kind: Exclude<AgentKind, "person">;
    lastUsedAt: string | null;
    callsToday: number;
    changesToday: number;
    refusedToday: number;
    failedToday: number;
    /** Sessions of the whole period that changed items and left no completion comment. */
    noComment: number;
};

const sameLocalDay = (iso: string | null, now: Date): boolean => {
    if (!iso) return false;
    const d = new Date(iso);
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
};

const laterOf = (a: string | null, b: string | null): string | null =>
    (a ?? "") >= (b ?? "") ? a : b;

/**
 * One row per connected app family (or one that ran a session): last use, and today's calls,
 * changes and refusals. "Today" is the viewer's local day and counts the sessions that ended
 * today, so a run that crossed midnight is counted whole on the day it ended. Credits are not
 * in the response, so the strip does not show them.
 */
export const buildAppStrip = (
    connections: AgentWorkConnection[],
    sessions: AgentWorkSession[],
    now: Date = new Date()
): AppStripRow[] => {
    const rows = new Map<AppStripRow["kind"], AppStripRow>();
    const row = (kind: AppStripRow["kind"]): AppStripRow => {
        let hit = rows.get(kind);
        if (!hit) {
            hit = {
                kind,
                lastUsedAt: null,
                callsToday: 0,
                changesToday: 0,
                refusedToday: 0,
                failedToday: 0,
                noComment: 0,
            };
            rows.set(kind, hit);
        }
        return hit;
    };
    for (const c of connections) {
        const kind = familyKind(c.family) as AppStripRow["kind"];
        const r = row(kind);
        r.lastUsedAt = laterOf(r.lastUsedAt, c.last_used_at);
    }
    for (const s of sessions) {
        const r = row(s.agent);
        r.lastUsedAt = laterOf(r.lastUsedAt, s.ended_at);
        if (s.no_completion_comment) r.noComment += 1;
        if (sameLocalDay(s.ended_at, now)) {
            r.callsToday += s.calls;
            r.changesToday += s.changed;
            r.refusedToday += s.refused;
            r.failedToday += s.failed;
        }
    }
    const order: AppStripRow["kind"][] = ["claude", "chatgpt", "api_key", "other_app"];
    return [...rows.values()].sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
};
