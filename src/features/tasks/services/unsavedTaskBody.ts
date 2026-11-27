/**
 * The task description words this browser could not be sure it saved (MIP-2455): the page was
 * reloaded or closed, or the save made while leaving the task failed. The words are in the editor
 * (the collab document) but not in the stored task, and nothing noticed on the next open.
 *
 * A record is written only at those moments and holds the text typed here and `base`, the stored
 * body it was typed on top of. On the next open the text is saved ONLY IF the server still holds
 * `base`. Anything else means someone wrote since (a teammate, an API or AI-app write, another
 * device), and theirs is never overwritten.
 */
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../types/admin";
import { loadSpecificTask } from "./loadSpecificTask";
import { sendUpdatedSpecificTask } from "./sendUpdatedSpecificTask";
import { TaskSaveRefusedError } from "./taskSaveRefusedError";

// Swept on sign-out (`signOutLeftovers`).
export const UNSAVED_TASK_BODY_PREFIX = "genos.unsavedTaskBody.v1.";

type UnsavedBody = { body: PartialBlock[]; base: string; at: number };

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

const read = (userId: string, taskId: number): UnsavedBody | null => {
    try {
        const raw = localStorage.getItem(keyOf(userId, taskId));
        return raw ? (JSON.parse(raw) as UnsavedBody) : null;
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

export const keepUnsavedBody = (
    userId: string,
    taskId: number,
    body: PartialBlock[],
    base: string
) => write(userId, taskId, { body, base, at: Date.now() });

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
    const same = bodyFingerprint(record.body) === bodyFingerprint(sent);
    // Words kept after that save set out are newer than it: still unsaved, now on top of it.
    if (!same && record.at > startedAt) {
        if (stored) write(userId, taskId, { ...record, base: bodyFingerprint(sent) });
        return;
    }
    // Otherwise a stored save carried these words or later ones. Keeping them would let the
    // next open put the older text over the newer.
    if (same || stored) write(userId, taskId, null);
};

/**
 * Saves what a record holds, if that is still safe. Resolves with the body it stored, else `null`.
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
}): Promise<PartialBlock[] | null> => {
    const record = read(myself.userId, taskId);
    if (!record) return null;
    const forget = () => write(myself.userId, taskId, null);

    // The server's own copy, never the cached one. Unreachable: keep the record for next time.
    const [task] = await loadSpecificTask(myself, projectId, taskId, accessToken, {
        forceRefresh: true,
    });
    if (!task || isSuperseded()) return null;
    const server = bodyFingerprint(task.body);
    if (server === bodyFingerprint(record.body) || server !== record.base) {
        forget();
        return null;
    }

    let failed: { retry: boolean } | null = null;
    try {
        await sendUpdatedSpecificTask(
            socket,
            myself,
            { ...task, body: record.body },
            false,
            accessToken,
            undefined,
            { onNotSaved: (retry) => (failed = { retry }) }
        );
    } catch (error) {
        if (!(error instanceof TaskSaveRefusedError)) throw error;
        failed = { retry: false };
    }
    const result = failed as { retry: boolean } | null;
    if (result?.retry) return null;
    forget();
    return result ? null : record.body;
};
