// The calm line under an answer when the server could not use something the ask pointed at
// (MIP-1058): the `done` event's `dropped_references`, as sentences.
//
// The server's rule (genos-api `agent_views`): the run still happened, as a plain question; the list
// holds KINDS only, the same whether the thing was missing, deleted, unreadable, out of the member's
// history window or malformed. So the sentence never says why, and never says "could not READ": it
// says "could not USE". `"message"` also comes back when MORE than 3 messages were sent and all of
// them resolved (the first 3 are read, the rest dropped), so a turn that pointed at several messages
// says "some of the messages", never "the message".

import type { DroppedReference } from "../../services/agentApi";
import type { AgentMentionRef } from "./mentions/types";

/** The four sentences, from the catalog (`spotlight.dropped`). */
export interface DroppedLabels {
    message: string;
    messages: string;
    selection: string;
    selectedFrom: string;
}

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
    return dropped.map((kind) => {
        switch (kind) {
            case "message":
                return countMessageMentions(mentions) > 1 ? labels.messages : labels.message;
            case "selection":
                return labels.selection;
            case "selected_from":
                return labels.selectedFrom;
        }
    });
};
