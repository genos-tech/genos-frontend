import axios from "axios";

import { authApi } from "../../services/api";

/**
 * "Your agents today" card on the Today tab (MIP-2004). The numbers come from the `sessions`
 * block of `GET /api/v2/agent/work/` (genos-api #1127): the viewer's OWN agent sessions from the
 * call log, ids and counts only. One request, `days=1`, `limit=1` (the card does not use the item
 * feed, so the page it asks for is as small as the API allows).
 *
 * The card is hidden unless there was activity, so every failure (an older API without the block,
 * the log being off, a 404, a network error) is the same answer: nothing to show.
 */

export type AgentsTodaySession = {
    agent: string;
    changed: number;
    decided: number;
    refused: number;
    itemsChanged: number;
    /** The changed items the answer listed (at most ten per session), as `type:id`. */
    changedItems: string[];
};

export type AgentsToday = {
    /** The apps that were used, in first-seen order (the API's own labels). */
    agents: string[];
    sessions: number;
    changes: number;
    /** Distinct items changed; `null` when a long session listed fewer items than it changed. */
    itemsChanged: number | null;
    decisions: number;
    refused: number;
};

const num = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

/** Sum the sessions of the answer. `null` when there were none (the card stays hidden). */
export const summariseSessions = (raw: unknown): AgentsToday | null => {
    const block = (raw as { sessions?: { items?: unknown; total?: unknown } } | null)?.sessions;
    if (!block || !Array.isArray(block.items) || block.items.length === 0) return null;
    const agents: string[] = [];
    const changedItems = new Set<string>();
    let complete = true;
    let changes = 0;
    let decisions = 0;
    let refused = 0;
    for (const entry of block.items as Record<string, unknown>[]) {
        const agent = typeof entry.agent === "string" ? entry.agent : "other_app";
        if (!agents.includes(agent)) agents.push(agent);
        changes += num(entry.changed);
        decisions += num(entry.decided);
        refused += num(entry.refused);
        let listed = 0;
        for (const item of Array.isArray(entry.items) ? entry.items : []) {
            if (!item || typeof item !== "object" || !(item as { changed?: unknown }).changed) {
                continue;
            }
            const { type, id } = item as { type?: unknown; id?: unknown };
            if (type == null || id == null) continue;
            changedItems.add(`${String(type)}:${String(id)}`);
            listed += 1;
        }
        if (num(entry.items_changed) > listed) complete = false;
    }
    const total = num(block.total) || block.items.length;
    return {
        agents,
        sessions: total,
        changes,
        itemsChanged: complete ? changedItems.size : null,
        decisions,
        refused,
    };
};

export type AgentsTodayResult =
    | { status: "ok"; data: AgentsToday | null }
    | { status: "unavailable" }
    | { status: "error" };

export const loadAgentsToday = async (
    accessToken: string | null,
    teamId: string,
    signal?: AbortSignal
): Promise<AgentsTodayResult> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return { status: "error" };
    try {
        const res = await api.get<unknown>("/agent/work/", {
            params: { team_id: teamId, days: 1, limit: 1 },
            signal,
            suppressErrorToast: true,
        });
        return { status: "ok", data: summariseSessions(res.data) };
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { status: "unavailable" };
        }
        return { status: "error" };
    }
};
