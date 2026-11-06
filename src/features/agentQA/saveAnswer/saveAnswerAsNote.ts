// One POST that puts an answer into My Notes.
//
// Posted straight to the note API, as `saveThreadAskAsNote` does, rather than
// through `createEmptyMyNote`: that helper swallows every failure and returns
// `undefined`, so a plan limit could not be told from any other error, and this
// save has to say which it was. Same endpoint, same payload shape; a new note's
// Yjs doc is empty, so the editor seeds from this REST body on first open.

import type { PartialBlock } from "@blocknote/core";
import axios from "axios";

import { authApi } from "../../../services/api";

/** The plan's monthly note cap (HTTP 429 `limit_reached`). */
export class NoteLimitError extends Error {
    constructor() {
        super("Note limit reached");
        this.name = "NoteLimitError";
    }
}

export interface SaveAnswerAsNoteArgs {
    accessToken: string | null;
    teamId: string;
    userId: string;
    title: string;
    blocks: PartialBlock[];
}

/** The new note's id. Throws `NoteLimitError` for a plan limit, anything else for the rest. */
export const saveAnswerAsNote = async (args: SaveAnswerAsNoteArgs): Promise<number> => {
    const api = authApi(args.accessToken);
    if (!api) throw new Error("Unauthorized: no access token.");
    if (!args.teamId || !args.userId) throw new Error("No signed-in team and user.");
    try {
        const res = await api.post("/note/personal/", {
            team_id: args.teamId,
            user_id: args.userId,
            parent_note_id: null,
            folder_id: null,
            title: args.title,
            body: args.blocks,
        });
        const noteId = res.data?.noteId ?? res.data?.note_id;
        if (typeof noteId !== "number") throw new Error("The server didn't return a note id.");
        return noteId;
    } catch (err) {
        if (
            axios.isAxiosError(err) &&
            (err.response?.status === 429 || err.response?.status === 413) &&
            err.response.data?.limit_reached
        ) {
            throw new NoteLimitError();
        }
        throw err;
    }
};
