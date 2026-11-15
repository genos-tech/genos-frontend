// A passage of text the member selected and pointed "Ask Genos" at (MIP-1058, genos-api
// AGENT_PARITY_TOOLS), and where it came from.
//
// It is not a mention: there is no `#token` for it in the draft, and nothing in the question text
// stands for it. It rides on the ask as two optional top-level fields of `POST /agent/ask/`:
//
//   selected_text   the passage. A string; blank means no selection; the server trims it, strips
//                   control and invisible characters and cuts it at 4,000 characters (with a note
//                   to the model, not an error).
//   selected_from   optional, ONE mention-shaped object saying where it came from (a message, a task,
//                   a note, ...). The server checks it with the asker's access and drops it if it
//                   cannot be used, so the passage is then used without a source. Ignored without
//                   `selected_text`.
//
// The selection belongs to ONE ask. A retry ("Ask again") re-sends both verbatim, which is why the
// finished turn keeps it (`CompletedTurn.selection`); a follow-up question is a new ask and carries
// a selection only if the member attached one to it.

import type { AgentMentionPayload } from "../../services/agentApi";
import { toWireMentions, type AgentMentionRef } from "./mentions/types";

/** The longest passage the server reads. It cuts there itself, so this is the client's own bound:
 *  nothing longer is sent, and the member is told when what they selected was cut. Counted in code
 *  points (what the server counts), so an emoji or a CJK character is never split. */
export const SELECTED_TEXT_MAX = 4000;

export interface AskSelection {
    /** The passage, already trimmed and cut (see `clipSelectionText`). */
    text: string;
    /** Where it came from, when that has an id: sent as `selected_from`. */
    from?: AgentMentionRef;
    /** True when `text` is only the start of what the member selected. Display only: the member is
     *  told so in the composer; it never goes on the wire. */
    truncated?: boolean;
}

/** Whether a mention of this kind can be where a selection came from: any kind but a person or a
 *  group, which have nothing to read, so the server would drop them as a source. The client never
 *  sends one. (Written as an exclusion so a new kind of mention is a possible source by default.) */
const canBeSource = (ref: AgentMentionRef): boolean => ref.kind !== "user" && ref.kind !== "group";

/** `raw` trimmed and cut to `SELECTED_TEXT_MAX` code points; `truncated` says whether it was cut.
 *  An empty (or all-blank) result is no selection: callers drop it. */
export const clipSelectionText = (raw: string): { text: string; truncated: boolean } => {
    const text = raw.trim();
    // Cheap exit: a UTF-16 string of this many units or fewer cannot hold more code points.
    if (text.length <= SELECTED_TEXT_MAX) return { text, truncated: false };
    const points = Array.from(text);
    if (points.length <= SELECTED_TEXT_MAX) return { text, truncated: false };
    return { text: points.slice(0, SELECTED_TEXT_MAX).join("").trimEnd(), truncated: true };
};

/** The selection as the member will see it attached, or null when there is nothing to attach
 *  (blank text). `from` is kept only when it names a kind a selection can come from. */
export const makeAskSelection = (
    rawText: string,
    from?: AgentMentionRef | null
): AskSelection | null => {
    const { text, truncated } = clipSelectionText(rawText);
    if (!text) return null;
    return {
        text,
        ...(from && canBeSource(from) ? { from } : {}),
        ...(truncated ? { truncated: true } : {}),
    };
};

/** The two request fields for `selection`, or `{}` when there is nothing to send. The text is cut
 *  again here, so no caller can put more than the server reads on the wire. */
export const toWireSelection = (
    selection: AskSelection | null | undefined
): { selected_text?: string; selected_from?: AgentMentionPayload } => {
    if (!selection) return {};
    const { text } = clipSelectionText(selection.text);
    if (!text) return {};
    const from =
        selection.from && canBeSource(selection.from)
            ? toWireMentions([selection.from])[0]
            : undefined;
    return { selected_text: text, ...(from ? { selected_from: from } : {}) };
};
