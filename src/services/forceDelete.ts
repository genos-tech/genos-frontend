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

/** Every batch of "all my messages" until the server says none remain (a guard stops a loop that
 *  makes no progress). */
export const forceDeleteAllMyMessages = async (
    accessToken: string | null,
    channelId: string
): Promise<number> => {
    let total = 0;
    for (let round = 0; round < 50; round += 1) {
        const res = await forceDeleteMyMessages(accessToken, channelId);
        total += res.removed.messages ?? 0;
        if (!res.remaining) return total;
    }
    return total;
};
