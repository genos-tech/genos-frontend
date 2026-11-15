// The calm line under an answer when the server could not use something the ask pointed at
// (MIP-1058): the `dropped_references` of the `done` event, as sentences. A run that pauses for a
// write approval says it on the approval card's event and again on the `done` of the resumed leg,
// which may add the task or milestone the conversation is about (MIP-1585): the turn holds the union
// (`mergeDroppedReferences`), so the member reads each sentence once.
//
// The server's rule (genos-api `agent_views`): the run still happened, as a plain question; the list
// holds KINDS only, the same whether the thing was missing, deleted, unreadable, out of the member's
// history window or malformed. So the sentence never says why, and never says "could not READ": it
// says "could not USE". `"message"` also comes back when MORE than 3 messages were sent and all of
// them resolved (the first 3 are read, the rest dropped), so a turn that pointed at several messages
// says "some of the messages", never "the message".

import type { DroppedReference } from "../../services/agentApi";
import type { AgentMentionRef } from "./mentions/types";

/** The five sentences, from the catalog (`spotlight.dropped`). `task` is for the task OR milestone
 *  a conversation is about: the server's kind does not say which, so neither does the sentence. */
export interface DroppedLabels {
    message: string;
    messages: string;
    selection: string;
    selectedFrom: string;
    task: string;
}

/** What the turn holds once a later list (the resumed leg's `done`, a second card) arrives: the union
 *  of the two, each kind once, in the order it first came, which is the server's order (it says what
 *  the ask dropped first, then what the decision could not use again). Never changes either list.
 *  Returns `earlier` ITSELF when `later` adds nothing, so state that holds it does not change, and
 *  `undefined` when neither has anything to say. */
export const mergeDroppedReferences = (
    earlier: DroppedReference[] | undefined,
    later: DroppedReference[] | undefined
): DroppedReference[] | undefined => {
    const merged = [...(earlier ?? [])];
    for (const kind of later ?? []) if (!merged.includes(kind)) merged.push(kind);
    if (merged.length === (earlier?.length ?? 0)) return earlier?.length ? earlier : undefined;
    return merged;
};

/** How many DIFFERENT messages the turn pointed at through `mentions`. A message that is only the
 *  source of a selection is not counted: the server reports that one as `"selected_from"`. */
export const countMessageMentions = (mentions?: readonly AgentMentionRef[]): number => {
    const ids = new Set<string>();
    for (const m of mentions ?? []) if (m.kind === "message") ids.add(m.messageId);
    return ids.size;
};

/** One sentence per dropped kind, in the server's order. `mentions` decides between "the message"
 *  and "some of the messages". Empty when nothing was dropped. */
export const droppedReferenceNotices = (
    dropped: readonly DroppedReference[] | undefined,
    mentions: readonly AgentMentionRef[] | undefined,
    labels: DroppedLabels
): string[] => {
    if (!dropped?.length) return [];
    const notices: string[] = [];
    for (const kind of dropped) {
        switch (kind) {
            case "message":
                notices.push(
                    countMessageMentions(mentions) > 1 ? labels.messages : labels.message
                );
                break;
            case "selection":
                notices.push(labels.selection);
                break;
            case "selected_from":
                notices.push(labels.selectedFrom);
                break;
            case "task":
                notices.push(labels.task);
                break;
            // A kind from a newer server says nothing: `asDroppedReferences` already drops it, and
            // a list handed in some other way must not put `undefined` on screen either.
        }
    }
    return notices;
};
