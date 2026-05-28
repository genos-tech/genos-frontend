/**
 * `useChannel(channelId)` — single-channel view hook.
 *
 * Replaces `useMessageManagement` + `useReadStatusManagement` +
 * `useScrollManagement` (which the chat surfaces wire individually
 * today). Returns the channel metadata, messages, the user's read
 * cursor, and the markRead helper.
 *
 * Reads from IDB (so the UI renders the cached snapshot instantly on
 * navigation) and subscribes to live updates via the socket router
 * — which `channelService.handle*` methods write to IDB, triggering
 * the live query refresh.
 *
 * Phase 4 scope: hook surface + return type only. The body wires
 * placeholder empty state for now — the live query plumbing arrives
 * in the same follow-up commit that fills in `channelService.handle*`
 * IDB writes. Keeping the surface stable from this commit means
 * consumers can be wired now and start receiving data the moment the
 * writes land.
 */

import { useState } from "react";

import { channelService } from "../../../services/channel/channelService";
import type { Channel, Message, ReadCursor } from "../../../types/channel";

export interface UseChannelResult {
    channel: Channel | null;
    messages: Message[];
    readCursor: ReadCursor | null;
    /**
     * Advance the read cursor to `messageId`. Forward-only — calling
     * with a lower seq than the existing cursor is a server-side no-op.
     */
    markRead: (messageId: string) => Promise<void>;
    /**
     * True while the initial IDB read is in flight (or while the
     * channel is being fetched from the server). False once the
     * hook is ready to render.
     */
    isLoading: boolean;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function useChannel(channelId: string): UseChannelResult {
    // TODO: replace these stubs with live queries against the IDB
    // CHANNELS / MESSAGES_V3 / READ_CURSORS stores. The stub shape
    // exists so consumers can be wired now; data flows once the writes
    // land in `channelService.handle*`.
    const [channel] = useState<Channel | null>(null);
    const [messages] = useState<Message[]>([]);
    const [readCursor] = useState<ReadCursor | null>(null);
    const [isLoading] = useState<boolean>(true);

    const markRead = async (_messageId: string): Promise<void> => {
        // TODO: route through the socket (`read.advance`) so the
        // server broadcasts `read.advanced` to other tabs in the same
        // user room. See plan §4.5.
        void channelService;
    };

    return { channel, messages, readCursor, markRead, isLoading };
}
/* eslint-enable @typescript-eslint/no-unused-vars */
