// Synthesise a BlockNote-format body from the thread summary + Q&A
// turns and POST it to `/note/chat/` as a chat note.
//
// We post directly to the note API rather than going through
// `useNoteManagement.createEmptyChatNote` + a follow-up update because:
//  1. `createEmptyChatNote` only writes a one-block placeholder body —
//     immediately overwriting it would be wasteful.
//  2. The "Save as Chat Note" action wants a single atomic operation
//     (one success/failure boundary the UI can surface).
//
// The summary + each answer are parsed with `markdownToBlocks` so the
// LLM's headings / bullets / bold / italic land as real BlockNote
// blocks the user can edit, rather than raw markdown text.

import { PartialBlock } from "@blocknote/core";

import { authApi } from "../../services/api";
import { UserProps } from "../../types/admin";
import { buildSourcesById, markdownToBlocks, type CompletedTurn } from "../agentQA";
import { SpotlightResult } from "../spotlight/types";

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

const italicPara = (text: string): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: [{ text, type: "text", styles: { italic: true, textColor: "gray" } }],
    children: [],
});

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

    // Aggregate every source referenced across all turns so a citation
    // emitted on turn 1 still resolves to its title when it shows up
    // again in turn 3's answer.
    const allSources: SpotlightResult[] = [];
    const seen = new Set<string>();
    for (const turn of args.turns) {
        for (const s of turn.answerSources || []) {
            const key = `${s.entity_type}:${s.entity_id}`;
            if (!seen.has(key)) {
                seen.add(key);
                allSources.push(s);
            }
        }
    }
    const sourcesById = buildSourcesById(allSources);

    const body: PartialBlock[] = [
        heading(args.summarySectionLabel),
        // The summary endpoint doesn't emit `sources`, so any citation
        // token in the summary text is unresolvable here. Pass an empty
        // map; unresolved tokens render as plain text, which is the
        // best we can do for now.
        ...markdownToBlocks(args.summaryText, new Map()),
        italicPara(args.metaLine),
    ];

    if (args.turns.length > 0) {
        body.push(heading(args.conversationSectionLabel));
        for (const turn of args.turns) {
            // Q: heading.
            body.push(heading(`${args.qLabel}: ${turn.askedQuery}`));
            if (turn.askError) {
                body.push(italicPara(`${args.aLabel}: (error) ${turn.askError}`));
            } else if (!turn.answer.trim()) {
                body.push(italicPara(`${args.aLabel}: (no answer)`));
            } else {
                // A: prefix, then the answer parsed as markdown with
                // citations resolved to inline link blocks.
                const answerBlocks = markdownToBlocks(turn.answer, sourcesById);
                // Prepend "A: " inline to the first paragraph so the
                // reader sees the answer label without an extra block.
                if (answerBlocks.length > 0 && answerBlocks[0].type === "paragraph") {
                    const firstBlockContent = answerBlocks[0].content;
                    answerBlocks[0] = {
                        ...answerBlocks[0],
                        content: [
                            {
                                type: "text",
                                text: `${args.aLabel}: `,
                                styles: { bold: true },
                            },
                            ...(Array.isArray(firstBlockContent) ? firstBlockContent : []),
                        ],
                    } as PartialBlock;
                } else {
                    // First block isn't a paragraph (e.g. starts with a
                    // heading) — emit a leading "A:" paragraph instead
                    // of trying to merge into a heading.
                    answerBlocks.unshift({
                        type: "paragraph",
                        props: PARA_PROPS,
                        content: [
                            { type: "text", text: args.aLabel + ":", styles: { bold: true } },
                        ],
                        children: [],
                    });
                }
                body.push(...answerBlocks);
            }
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
