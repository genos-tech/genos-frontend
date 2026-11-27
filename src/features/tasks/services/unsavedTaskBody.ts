/**
 * The task description words this browser could not be sure it saved (MIP-2455): the page was
 * reloaded or closed, or the save made while leaving the task failed. The words are in the editor
 * (the collab document) but not in the stored task, and nothing noticed on the next open.
 *
 * A record is written only at those moments and holds the text typed here and `bases`: the stored
 * bodies it can be on top of (the one it was typed on, and any save of ours still in flight, which
 * may or may not arrive). On the next open the text is saved ONLY IF the server still holds one of
 * them. Anything else means someone wrote since (a teammate, an API or AI-app write, another
 * device), and theirs is never overwritten. The repair sends the body alone.
 */
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { isRetryableSaveError } from "./isRetryableSaveError";
import { loadSpecificTask } from "./loadSpecificTask";

// Swept on sign-out (`signOutLeftovers`).
export const UNSAVED_TASK_BODY_PREFIX = "genos.unsavedTaskBody.v1.";

// Old text brought back after this long would surprise more than it would help.
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;

type UnsavedBody = { body: PartialBlock[]; bases: string[]; at: number };

const keyOf = (userId: string, taskId: number) => `${UNSAVED_TASK_BODY_PREFIX}${userId}.${taskId}`;

/** The same text for the same body, whatever order the database gives the keys back in. */
export const bodyFingerprint = (body: unknown): string =>
    JSON.stringify(body ?? [], (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(
                  Object.keys(value)
                      .sort()
                      .map((k) => [k, (value as Record<string, unknown>)[k]])
              )
            : value
    );

// ------------------------------------------------------------ the record --

// Set by the sign-out sweep: the preview unmounts AFTER it, and must not write the text back.
let signedOut = false;
export const stopKeepingUnsavedBodies = () => {
    signedOut = true;
};
export const resumeKeepingUnsavedBodies = () => {
    signedOut = false;
};

const read = (userId: string, taskId: number): UnsavedBody | null => {
    try {
        const raw = localStorage.getItem(keyOf(userId, taskId));
        if (!raw) return null;
        const record = JSON.parse(raw) as UnsavedBody;
        if (Date.now() - record.at <= KEEP_FOR_MS) return record;
        localStorage.removeItem(keyOf(userId, taskId));
        return null;
    } catch {
        return null;
    }
};

const write = (userId: string, taskId: number, record: UnsavedBody | null) => {
    try {
        if (record) localStorage.setItem(keyOf(userId, taskId), JSON.stringify(record));
        else localStorage.removeItem(keyOf(userId, taskId));
    } catch {
        // Storage full or unavailable: the repair is a safety net, never a requirement.
    }
};

// ------------------------------------------------------ saves on the way --

const saves = new Map<number, { inFlight: string[]; lastStartedAt: number }>();
const savesOf = (taskId: number) => {
    let entry = saves.get(taskId);
    if (!entry) saves.set(taskId, (entry = { inFlight: [], lastStartedAt: 0 }));
    return entry;
};

/** A save of this task's body is going out. Call the result when its request is over. */
export const trackTaskBodySave = (taskId: number, body: PartialBlock[]): (() => void) => {
    const entry = savesOf(taskId);
    const sent = bodyFingerprint(body);
    entry.inFlight.push(sent);
    entry.lastStartedAt = Date.now();
    return () => {
        const at = entry.inFlight.indexOf(sent);
        if (at !== -1) entry.inFlight.splice(at, 1);
    };
};

const repairing = new Map<number, Promise<unknown>>();
/** A repair of this task on its way: a save made now must follow it, or the older text could
 *  land last. */
export const unsavedBodyRepairOf = (taskId: number): Promise<unknown> | undefined =>
    repairing.get(taskId);

/** What a page reload loses: which saves and repairs are on their way. For tests. */
export const forgetTaskBodySaves = () => {
    saves.clear();
    repairing.clear();
};

export const keepUnsavedBody = (
    userId: string,
    taskId: number,
    body: PartialBlock[],
    base: string
) => {
    if (signedOut) return;
    write(userId, taskId, { body, bases: [base, ...savesOf(taskId).inFlight], at: Date.now() });
};

/**
 * A save of this task's body is over: `stored`, or refused for good. `startedAt` is when that save
 * took the text.
 */
export const settleUnsavedBody = (
    userId: string,
    taskId: number,
    sent: PartialBlock[],
    { stored, startedAt }: { stored: boolean; startedAt: number }
) => {
    const record = read(userId, taskId);
    if (!record) return;
    const fingerprint = bodyFingerprint(sent);
    if (fingerprint === bodyFingerprint(record.body)) {
        write(userId, taskId, null);
        return;
    }
    if (!stored) return;
    // Words kept after that save set out are newer than it: still unsaved, now on top of it.
    if (record.at > startedAt) write(userId, taskId, { ...record, bases: [fingerprint] });
    // A later save that only restates what was stored (a status change made before the editor
    // had the words) says nothing about them. One with other text is newer than they are.
    else if (!record.bases.includes(fingerprint)) write(userId, taskId, null);
};

// ------------------------------------------------------------ the repair --

export type RepairedBody = { stored: PartialBlock[]; bases: string[] };

const emitMentions = (
    socket: Socket | null,
    task: TaskProps,
    data: {
        task?: { ts_updated_at?: string };
        newly_mentioned_user_ids?: string[];
        all_mentioned_user_ids?: string[];
        removed_user_ids?: string[];
    }
) => {
    const newly = data.newly_mentioned_user_ids ?? [];
    const removed = data.removed_user_ids ?? [];
    if (!socket || (newly.length === 0 && removed.length === 0)) return;
    socket.emit("task_body_mention", {
        task_id: task.id,
        task_title: task.title,
        project_id: task.project?.projectId,
        project_name: task.project?.projectName,
        display_id: task.displayId,
        ts_mentioned_at: data.task?.ts_updated_at,
        newly_mentioned_user_ids: newly,
        all_mentioned_user_ids: data.all_mentioned_user_ids ?? newly,
        removed_user_ids: removed,
    });
};

/**
 * Saves what a record holds, if that is still safe. Resolves with what it stored, else `null`.
 * `isSuperseded`: the person has typed in the open preview meanwhile, so its own autosave is the
 * newer one.
 */
export const repairUnsavedTaskBody = async ({
    myself,
    taskId,
    projectId,
    accessToken,
    socket,
    isSuperseded,
}: {
    myself: UserProps;
    taskId: number;
    projectId: number;
    accessToken: string | null;
    socket: Socket | null;
    isSuperseded: () => boolean;
}): Promise<RepairedBody | null> => {
    const record = read(myself.userId, taskId);
    const api = authApi(accessToken);
    if (!record || !api || repairing.has(taskId)) return null;
    const startedAt = Date.now();

    // The server's own copy, never the cached one. Unreachable: keep the record for next time.
    const [task] = await loadSpecificTask(myself, projectId, taskId, accessToken, {
        forceRefresh: true,
    });
    if (!task) return null;
    // Anything newer since we started (words kept again, a save, typing) wins. A save still on
    // its way may yet change what the server holds: look again at the next open.
    const { inFlight, lastStartedAt } = savesOf(taskId);
    if (read(myself.userId, taskId)?.at !== record.at) return null;
    if (inFlight.length > 0 || lastStartedAt > startedAt || isSuperseded()) return null;

    const forget = () => {
        if (read(myself.userId, taskId)?.at === record.at) write(myself.userId, taskId, null);
    };
    const server = bodyFingerprint(task.body);
    if (server === bodyFingerprint(record.body) || !record.bases.includes(server)) {
        forget();
        return null;
    }

    const put = api.put("/task/", {
        task_id: taskId,
        team: myself.teamId,
        project: projectId,
        content: record.body,
    });
    repairing.set(
        taskId,
        put.catch(() => undefined)
    );
    try {
        const response = await put;
        forget();
        emitMentions(socket, task, response?.data ?? {});
        // The cached copy of the task still has the old body.
        void loadSpecificTask(myself, projectId, taskId, accessToken, { forceRefresh: true });
        return { stored: record.body, bases: record.bases };
    } catch (error) {
        console.error("Could not save the task description kept in this browser:", error);
        if (!isRetryableSaveError(error)) forget();
        return null;
    } finally {
        repairing.delete(taskId);
    }
};
