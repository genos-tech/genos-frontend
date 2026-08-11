/**
 * Frozen "open at the first unread message" index for a chat pane.
 *
 * Returns the index the pane should land on when it opens (see
 * `resolveFirstUnreadIndex`), or `null` to keep the existing "land at the
 * bottom" behaviour.
 *
 * FROZEN PER CHAT — this is the crux. The read cursor advances as the user
 * reads (the seen-observer marks messages read), which changes
 * `ReadCursor.lastReadMessageId`. If the landing index tracked that live, it
 * would recompute mid-session and re-scroll the reader. So we capture it ONCE,
 * the first render a chat has messages, and hold it until the chat changes.
 *
 * READ IMPERATIVELY, not via a subscription. The cursor is pulled from
 * `channelService.getSnapshot()` at capture time rather than through
 * `useChannel`/`useSyncExternalStore` on purpose: subscribing would re-render
 * the pane on every cursor advance — i.e. on every read-status throttle tick
 * while scrolling — which is exactly the re-render-on-scroll jank the chat
 * hooks (see `useReadStatusManagement`, `useScrollManagement`) deliberately
 * keep off the hot path. A one-shot read at open costs nothing after.
 *
 * SCOPE: only the main timeline has a cursor in `cursorsByChannel` (thread
 * cursors aren't wired there yet), so thread panes always get `null` and keep
 * their bottom-landing behaviour — first-unread is a main/sub-chat feature.
 */
import { useRef } from "react";

import { channelService } from "../../../services/channel/channelService";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";
import { resolveFirstUnreadIndex } from "../utils/firstUnread";

interface UseFirstUnreadIndexParams {
    chat: ChatProps | ThreadProps;
    isThread: boolean;
}

export const useFirstUnreadIndex = ({
    chat,
    isThread,
}: UseFirstUnreadIndexParams): number | null => {
    // Identity of the chat/thread this landing was captured for.
    const chatKey = isThread
        ? `${chat.chatId}:${(chat as ThreadProps).threadId}`
        : String(chat.chatId);

    const frozen = useRef<{ key: string | null; index: number | null }>({
        key: null,
        index: null,
    });

    // Capture once per chat, the first render the messages are present. Doing
    // it in render (not an effect) makes the value available on the mount
    // render for Virtuoso's `initialTopMostItemIndex`. Adjusting a ref when an
    // input changes is the sanctioned "derive-on-change" pattern.
    const messages = chat.messages as (MessageProps | ThreadMessageProps)[];
    if (messages.length > 0 && frozen.current.key !== chatKey) {
        // A deep-link jump (`moveToSpecificIndex`) takes priority over
        // first-unread: the user asked for a specific message, so don't
        // second-guess where to land. Leave `index` null and let the jump
        // path own the scroll.
        if (chat.moveToSpecificIndex) {
            frozen.current = { key: chatKey, index: null };
        } else {
            // Main-timeline cursor only; threads have no entry here → null.
            const cursorMessageId = isThread
                ? null
                : (channelService.getSnapshot().cursorsByChannel.get(String(chat.chatId))
                      ?.lastReadMessageId ?? null);
            frozen.current = {
                key: chatKey,
                index: resolveFirstUnreadIndex(messages, cursorMessageId, isThread),
            };
        }
    }

    // Only return the frozen value for the chat it was captured for. Before
    // messages arrive (cold sync / skeleton) the key won't match yet → null,
    // which is the correct bottom-landing default until we can compute.
    return frozen.current.key === chatKey ? frozen.current.index : null;
};
