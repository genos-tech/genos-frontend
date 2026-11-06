// The note or task body made from one answer.
//
// The FULL stored answer, not what the screen shows: the markdown the model
// wrote, parsed with the same `markdownToBlocks` the thread-ask save uses, so
// headings, lists and bold land as real BlockNote blocks and a citation becomes
// a link to what it cites. One italic line above it says which question it
// answers. The same blocks serve a note and a task, so a task made from an
// answer reads like one made from a to-do's notes.
//
// Plain TypeScript, type-only BlockNote import: the agentQA barrel is in the
// entry chunk (see `markdownToBlocks.ts`).

import type { PartialBlock } from "@blocknote/core";

import type { SpotlightResult } from "../../spotlight/types";
import { buildSourcesById } from "../citationUtils";
import { markdownToBlocks } from "../markdownToBlocks";

// The most UTF-8 bytes of answer text saved. The API takes the same body from the
// agent's own note and task writes under this cap (`AGENT_MAX_BODY_BYTES`,
// 262144), so a body this size is one the app already accepts from Genos.
export const MAX_ANSWER_BYTES = 262_144;
// The REST body (blocks as JSON) the saves send. Django refuses a request body over
// 2.5 MB with a 400, and blocks cost far more than their text, so this stops short
// of it and refuses with a sentence instead of a failed request.
export const MAX_BODY_JSON_CHARS = 1_000_000;

const TITLE_MAX = 80;
const QUESTION_IN_INTRO_MAX = 200;

const PARA_PROPS = {
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/** `text` cut to `max` characters (code points, so no half an emoji), with an ellipsis. */
export const capText = (text: string, max: number): string => {
    const chars = Array.from(text);
    return chars.length > max
        ? `${chars
              .slice(0, max - 1)
              .join("")
              .trimEnd()}…`
        : text;
};

/** The title of a note or task made from an answer: the question, tidied. */
export const answerTitle = (askedQuery: string, fallback: string): string =>
    capText(collapse(askedQuery), TITLE_MAX) || fallback;

export type AnswerBody = { ok: true; blocks: PartialBlock[] } | { ok: false; reason: "tooLong" };

export interface AnswerBodyInput {
    askedQuery: string;
    answer: string;
    answerSources: readonly SpotlightResult[];
    // The turn's own lookup when the host resolves citations across the whole
    // conversation (the Ask modals); else built from the turn's sources.
    sourcesById?: ReadonlyMap<string, SpotlightResult>;
    // "Genos answer to: {question}", already localised, with `{question}` still in it.
    introTemplate: string;
}

export const buildAnswerBody = ({
    askedQuery,
    answer,
    answerSources,
    sourcesById,
    introTemplate,
}: AnswerBodyInput): AnswerBody => {
    // Before any parsing: the cost is in the parse.
    if (new TextEncoder().encode(answer).length > MAX_ANSWER_BYTES) {
        return { ok: false, reason: "tooLong" };
    }
    const lookup = sourcesById ?? buildSourcesById([...answerSources]);
    const blocks: PartialBlock[] = [];
    const question = capText(collapse(askedQuery), QUESTION_IN_INTRO_MAX);
    if (question) {
        blocks.push({
            type: "paragraph",
            props: PARA_PROPS,
            content: [
                {
                    type: "text",
                    text: introTemplate.replace("{question}", question),
                    styles: { italic: true, textColor: "gray" },
                },
            ],
            children: [],
        });
    }
    blocks.push(...markdownToBlocks(answer, lookup));
    if (JSON.stringify(blocks).length > MAX_BODY_JSON_CHARS) {
        return { ok: false, reason: "tooLong" };
    }
    return { ok: true, blocks };
};
