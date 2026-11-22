import axios from "axios";

import { v3ApiBaseURL } from "./v3Api";

/**
 * Force delete (MIP-1584): the immediate, irreversible delete of a message, all of one's messages in
 * a chat, a task, a task comment or a note. Every call carries the typed-confirmation body the
 * server insists on; the server decides who may (`403 forbidden`) and answers `404` for what the
 * caller cannot see. A refusal rejects with `ForceDeleteError` so a dialog can say why.
 */
export const FORCE_DELETE_CONFIRM = "delete-permanently";

export type ForceDeleteResult = {
    deleted: true;
    kind: "message" | "dm_messages" | "task" | "comment" | "note";
    id: string;
    removed: Record<string, number>;
    left: Record<string, number>;
    /** Task only: its row was kept empty (its number is the project's highest). */
    scrubbed?: boolean;
    /** "All my messages" only: how many are still to go; call again until 0. */
    remaining?: number;
};

export class ForceDeleteError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = "ForceDeleteError";
    }
}

const post = async (accessToken: string | null, path: string): Promise<ForceDeleteResult> => {
    if (!accessToken) throw new ForceDeleteError(401, "unauthenticated", "Not signed in.");
    try {
        const res = await axios.post<ForceDeleteResult>(
            `${v3ApiBaseURL()}${path}`,
            { confirm: FORCE_DELETE_CONFIRM },
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                withCredentials: true,
                suppressErrorToast: true,
            }
        );
        return res.data;
    } catch (e) {
        if (axios.isAxiosError(e)) {
            const data = e.response?.data as { error?: string; code?: string } | undefined;
            throw new ForceDeleteError(
                e.response?.status ?? 0,
                data?.code ?? "failed",
                data?.error ?? e.message
            );
        }
        throw e;
    }
};

export const forceDeleteMessage = (accessToken: string | null, messageId: string) =>
    post(accessToken, `/api/v3/messages/${messageId}/force-delete/`);

/** One batch of the caller's own messages in a chat; loop until `remaining` is 0. */
export const forceDeleteMyMessages = (accessToken: string | null, channelId: string) =>
    post(accessToken, `/api/v3/channels/${channelId}/my-messages/force-delete/`);

export const forceDeleteTask = (accessToken: string | null, taskId: number) =>
    post(accessToken, `/api/v3/tasks/${taskId}/force-delete/`);

export const forceDeleteComment = (
    accessToken: string | null,
    taskId: number,
    commentId: number
) => post(accessToken, `/api/v3/tasks/${taskId}/comments/${commentId}/force-delete/`);

export const forceDeleteNote = (
    accessToken: string | null,
    family: "personal" | "task" | "chat",
    noteId: number
) => post(accessToken, `/api/v3/notes/${family}/${noteId}/force-delete/`);

/** Rounds are 200 messages each (the server's batch); this is a runaway guard, not a limit anyone meets. */
const MAX_ROUNDS = 200;

/** Every batch of "all my messages" until the server says none remain. Resolves with how many were
 *  erased; rejects with code `incomplete` when messages are still left because a round made no
 *  progress, the guard ran out, or a later round failed after some were erased, so the caller never shows a success it did not get (MIP-1943). */
export const forceDeleteAllMyMessages = async (
    accessToken: string | null,
    channelId: string
): Promise<number> => {
    let total = 0;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
        let res: ForceDeleteResult;
        try {
            res = await forceDeleteMyMessages(accessToken, channelId);
        } catch (e) {
            // Earlier rounds already erased messages: "nothing was removed" would be false (MIP-1951).
            if (total > 0 && e instanceof ForceDeleteError) {
                throw new ForceDeleteError(e.status, "incomplete", e.message);
            }
            throw e;
        }
        const removed = res.removed.messages ?? 0;
        total += removed;
        if (!res.remaining) return total;
        if (removed === 0) break;
    }
    throw new ForceDeleteError(0, "incomplete", "Some messages are still left.");
};
