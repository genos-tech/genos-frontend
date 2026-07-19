import { UserProps } from "../../../types/admin";
import { extractMMDD } from "../../../utils/dateUtils";

export type MessageItemMeta = {
    showDateSeparator: boolean;
    dateLabel: string;
    isSimpleBubble: boolean;
    paddingTop: number;
    paddingBottom: number;
};

type MetaSourceMessage = {
    tsSent: string;
    sender: { userId: UserProps["userId"] };
};

// Two consecutive messages from the same sender within this window
// collapse into one visual group (the later bubble drops its avatar +
// name row).
const SIMPLE_BUBBLE_WINDOW_MS = 600 * 1000;

/**
 * Pre-compute every per-row datum the message list needs, in a single
 * O(N) pass. Virtuoso re-invokes `itemContent` for every visible cell on
 * each scroll tick / context change — deriving these there meant 20–30×
 * redundant string parsing and array lookups per frame on a 1k-message
 * chat.
 *
 * Each timestamp is parsed exactly once and carried to the next
 * iteration. The previous in-component version re-derived the prior
 * row's date label and re-parsed both timestamps per row (~6 `Date`
 * constructions each) — at 100k messages that made every `messages`
 * identity change a multi-hundred-ms stall.
 */
export const computeMessageItemMetas = (
    messages: readonly MetaSourceMessage[],
    isThread: boolean,
    chatType: number
): MessageItemMeta[] => {
    const out = new Array<MessageItemMeta>(messages.length);
    let prevEpoch = 0;
    let prevDayKey = -1;
    let prevSenderId: UserProps["userId"] | null = null;
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        // Same parse as `dateUtils.convertAlmostIsoUtcToLocalFormatted`:
        // space → "T", then local-time fields.
        const sent = new Date(msg.tsSent.replace(" ", "T"));
        const epoch = sent.getTime();
        const dayKey = sent.getFullYear() * 10000 + sent.getMonth() * 100 + sent.getDate();

        const showDateSeparator = i === 0 || dayKey !== prevDayKey;
        // The label itself is only materialized for separator rows —
        // one per day, not one per message.
        const dateLabel = showDateSeparator ? extractMMDD(msg.tsSent) : "";

        // PM main-pane bubbles are task cards and never group; threads
        // group regardless of the host chat's type.
        const isSimpleBubble =
            i > 0 &&
            prevSenderId === msg.sender.userId &&
            Math.abs(epoch - prevEpoch) < SIMPLE_BUBBLE_WINDOW_MS &&
            (isThread || chatType !== 3);

        let paddingBottom = 0.3;
        if (i === messages.length - 1) paddingBottom += 3;

        out[i] = {
            dateLabel,
            isSimpleBubble,
            paddingBottom,
            paddingTop: 0.3,
            showDateSeparator,
        };
        prevEpoch = epoch;
        prevDayKey = dayKey;
        prevSenderId = msg.sender.userId;
    }
    return out;
};
