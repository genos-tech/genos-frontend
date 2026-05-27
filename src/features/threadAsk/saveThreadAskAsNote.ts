// Synthesise a BlockNote-format body from the thread summary + Q&A turns
// and POST it to `/note/chat/` as a chat note.
//
// We post directly to the note API rather than going through
// `useNoteManagement.createEmptyChatNote` + a follow-up update, because:
//  1. `createEmptyChatNote` only writes a one-block placeholder body —
//     immediately overwriting it would be wasteful.
//  2. The "Save as Chat Note" action wants a single atomic operation
//     (one success/failure boundary the UI can surface).
//
// Block construction mirrors `features/tasks/utils/taskTemplates.ts` so
// the resulting note looks consistent with the rest of the app.

import { PartialBlock } from "@blocknote/core";

import { authApi } from "../../services/api";
import { UserProps } from "../../types/admin";
import type { CompletedTurn } from "../spotlight/useSpotlight";

const HEADING_PROPS = {
    level: 3,
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const PARA_PROPS = {
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const heading = (text: string): PartialBlock => ({
    type: "heading",
    props: HEADING_PROPS,
    content: [{ text, type: "text", styles: {} }],
    children: [],
});

const para = (text: string): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: text ? [{ text, type: "text", styles: {} }] : [],
    children: [],
});

const italicPara = (text: string): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: [{ text, type: "text", styles: { italic: true, textColor: "gray" } }],
    children: [],
});

// Split a markdown-ish summary on blank lines into paragraphs. Doesn't
// try to render bold/italic — the summary text is shown verbatim. The
// editor will let the user clean it up after save if needed.
const summaryToBlocks = (summary: string): PartialBlock[] => {
    const trimmed = summary.trim();
    if (!trimmed) return [para("")];
    const paragraphs = trimmed
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    return paragraphs.length > 0 ? paragraphs.map(para) : [para(trimmed)];
};

const turnToBlocks = (turn: CompletedTurn, qLabel: string, aLabel: string): PartialBlock[] => {
    const blocks: PartialBlock[] = [];
    blocks.push(heading(`${qLabel}: ${turn.askedQuery}`));
    if (turn.askError) {
        blocks.push(italicPara(`${aLabel}: (error) ${turn.askError}`));
    } else {
        const ansParagraphs = turn.answer
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean);
        if (ansParagraphs.length === 0) {
            blocks.push(italicPara(`${aLabel}: (no answer)`));
        } else {
            // First paragraph carries the "A:" label inline so the
            // reader doesn't have to hunt for the answer.
            blocks.push(para(`${aLabel}: ${ansParagraphs[0]}`));
            for (const p of ansParagraphs.slice(1)) {
                blocks.push(para(p));
            }
        }
    }
    return blocks;
};

export interface SaveThreadAskArgs {
    myself: UserProps;
    accessToken: string | null;
    chatType: number;
    chatId: number;
    threadId: number;
    title: string;
    summaryText: string;
    summaryUpdatedIso: string;
    turns: CompletedTurn[];
    // i18n strings the caller resolves so this module stays string-free.
    summarySectionLabel: string; // e.g. "Summary"
    conversationSectionLabel: string; // e.g. "Follow-up Q&A"
    metaLine: string; // e.g. "Saved 2026-05-27 · 4 messages"
    qLabel: string; // e.g. "Q"
    aLabel: string; // e.g. "A"
}

// Returns the created note's `noteId` on success, throws on failure.
export const saveThreadAskAsNote = async (args: SaveThreadAskArgs): Promise<number> => {
    const api = authApi(args.accessToken);
    if (!api) throw new Error("Unauthorized — no access token.");

    const body: PartialBlock[] = [
        heading(args.summarySectionLabel),
        ...summaryToBlocks(args.summaryText),
        italicPara(args.metaLine),
    ];
    if (args.turns.length > 0) {
        body.push(heading(args.conversationSectionLabel));
        for (const turn of args.turns) {
            body.push(...turnToBlocks(turn, args.qLabel, args.aLabel));
        }
    }

    const res = await api.post("/note/chat/", {
        team_id: args.myself.teamId,
        user_id: args.myself.userId,
        parent_note_id: null,
        chat_type: args.chatType,
        chat_id: args.chatId,
        is_thread: true,
        thread_id: args.threadId,
        title: args.title,
        body,
    });

    const noteId = res.data?.noteId ?? res.data?.note_id;
    if (typeof noteId !== "number") {
        throw new Error("Server didn't return a noteId.");
    }
    return noteId;
};
