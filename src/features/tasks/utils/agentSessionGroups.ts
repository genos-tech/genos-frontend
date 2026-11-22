/**
 * Collapse one agent session's consecutive history rows into a block (MIP-2005).
 *
 * An agent that works on a task for ten minutes leaves 6 to 30 rows (a comment, a
 * status, a description edit...) and buries the person's own changes. The feed groups
 * consecutive rows that the same app / key wrote for the same person.
 *
 * Session identity. The sessions API (`GET /api/v2/agent/work/`, genos-api #1127)
 * groups by a synthetic `run_id`, but the task activity rows do not carry it yet. When
 * a row has `metadata.run_id` (or `runId`) it is the key and nothing else matters; until
 * then rows are grouped on the client by app + person + a quiet gap: the same rule the
 * server uses to open a new synthetic session (20 minutes without a call).
 *
 * Only rows that a connected app or an API key wrote (`viaSourceOfRow`) can be grouped;
 * a person's own row, a GitHub row and an in-app AI row end the group they sit in.
 * The list is newest first, as the API returns it, and so are the groups.
 */

import type { TaskActivityProps } from "../../../types/tasks";
import { parseServerTime } from "./relativeAge";
import { viaSourceOfRow, type ViaSource } from "./viaSource";

/** A session collapses only from this many rows; fewer stay as plain rows. */
export const MIN_SESSION_ROWS = 3;

/** The quiet time that closes a session, like the server's synthetic session. */
export const SESSION_GAP_MS = 20 * 60 * 1000;

export type ActivityEntry =
    | { kind: "row"; row: TaskActivityProps }
    | {
          kind: "session";
          /** Stable across renders: the newest row's id. */
          key: string;
          /** Newest first. */
          rows: TaskActivityProps[];
          via: ViaSource;
          /** Epoch ms of the oldest and the newest row; null if a time cannot be read. */
          from: number | null;
          to: number | null;
      };

const runIdOf = (row: TaskActivityProps): string | null => {
    const raw = row.metadata?.run_id ?? row.metadata?.runId;
    return typeof raw === "string" && raw !== "" ? raw : null;
};

type Probe = { key: string; hasRunId: boolean; via: ViaSource; at: number | null };

const probe = (row: TaskActivityProps, myselfId: string | number | null): Probe | null => {
    const via = viaSourceOfRow(row, myselfId);
    if (!via) return null;
    const runId = runIdOf(row);
    const actor = row.actor?.userId == null ? "" : String(row.actor.userId);
    const key = runId ? `run:${runId}` : `${via.kind}|${via.app ?? ""}|${actor}`;
    return { key, hasRunId: runId !== null, via, at: parseServerTime(row.tsCreatedAt) };
};

export const groupAgentSessions = (
    rows: TaskActivityProps[],
    myselfId: string | number | null
): ActivityEntry[] => {
    const out: ActivityEntry[] = [];
    let i = 0;
    while (i < rows.length) {
        const first = probe(rows[i], myselfId);
        if (!first) {
            out.push({ kind: "row", row: rows[i] });
            i += 1;
            continue;
        }
        let j = i + 1;
        let prevAt = first.at;
        while (j < rows.length) {
            const next = probe(rows[j], myselfId);
            if (!next || next.key !== first.key) break;
            // Without a run id, a long quiet gap (or an unreadable time) is a new session.
            if (!first.hasRunId) {
                if (prevAt == null || next.at == null) break;
                if (Math.abs(prevAt - next.at) > SESSION_GAP_MS) break;
            }
            prevAt = next.at;
            j += 1;
        }
        const group = rows.slice(i, j);
        if (group.length >= MIN_SESSION_ROWS) {
            const times = group
                .map((r) => parseServerTime(r.tsCreatedAt))
                .filter((n): n is number => n != null);
            out.push({
                kind: "session",
                key: `session-${group[0].activityId}`,
                rows: group,
                via: first.via,
                from: times.length ? Math.min(...times) : null,
                to: times.length ? Math.max(...times) : null,
            });
        } else {
            for (const row of group) out.push({ kind: "row", row });
        }
        i = j;
    }
    return out;
};

/** The words of a comment body (BlockNote blocks), one line, for matching a status reason. */
const plainText = (body: unknown): string => {
    const parts: string[] = [];
    const walk = (node: unknown) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node == null || typeof node !== "object") return;
        const n = node as { text?: unknown; content?: unknown; children?: unknown };
        if (typeof n.text === "string") parts.push(n.text);
        walk(n.content);
        walk(n.children);
    };
    walk(body);
    return parts.join(" ").replace(/\s+/g, " ").trim();
};

const REASON_WINDOW_MS = 2 * 60 * 1000;
// "Status: Open → Pending: waits for the release window" (genos-api task_status_reason.py).
const STATUS_COMMENT = /^Status:\s*(.+?)\s*→\s*(.+?):\s+(.+)$/s;

type CommentLike = {
    senderId: string | number | null;
    tsSent: string;
    commentBody: unknown;
};

/**
 * Why a status changed, shown inline on its row (MIP-1997). Sources, in order:
 * `metadata.reason` when the server stamps one on the row, else the status comment the
 * connector posts in the caller's name right after the change ("Status: A → B: why"),
 * matched on the same person, the same two statuses and a two-minute window. Null when
 * the change came with no reason.
 */
export const statusReasonOf = (
    row: TaskActivityProps,
    comments: CommentLike[] | undefined
): string | null => {
    if (row.actionType !== "status_changed") return null;
    const stamped = row.metadata?.reason;
    if (typeof stamped === "string" && stamped.trim() !== "") return stamped.trim();
    if (!comments?.length) return null;
    const at = parseServerTime(row.tsCreatedAt);
    const actor = row.actor?.userId;
    if (at == null || actor == null) return null;
    for (const comment of comments) {
        if (String(comment.senderId) !== String(actor)) continue;
        const sent = parseServerTime(comment.tsSent);
        if (sent == null || Math.abs(sent - at) > REASON_WINDOW_MS) continue;
        const m = STATUS_COMMENT.exec(plainText(comment.commentBody));
        if (!m) continue;
        const [, from, to, reason] = m;
        if (
            String(row.oldValue ?? "").toLowerCase() === from.toLowerCase() &&
            String(row.newValue ?? "").toLowerCase() === to.toLowerCase()
        ) {
            return reason.trim();
        }
    }
    return null;
};
