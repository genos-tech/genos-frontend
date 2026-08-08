/**
 * Bootstrap hook for the v3 messaging stack.
 *
 * Wires `channelService` into the app lifecycle:
 *
 *   1. Opens a socket on the `/v3` namespace (parallel to the legacy
 *      `/` socket so the existing chat surfaces keep working).
 *   2. Pushes the access token / user id / socket onto the service.
 *   3. Registers the socket router so every server-pushed `/v3` event
 *      flows into the reactive store.
 *   4. Calls `hydrateFromIDB()` on mount so hooks render off the cache
 *      immediately; live events + REST refreshes fill any gaps.
 *
 * Lifecycle / cleanup: on accessToken change (re-login, refresh) or
 * unmount, the v3 socket is disconnected, the router listeners are
 * unregistered, and the service's socket/token slots are cleared.
 * Idempotent under StrictMode double-mount because each effect's
 * cleanup runs before the next effect body.
 *
 * Returns the current `Socket` so callers that need to emit
 * directly (or display connection status) can. Most consumers go
 * through `channelService` mutation methods and don't touch this.
 */

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

import { setMediaAccessToken } from "../../utils/mediaAuth";
import { channelService } from "./channelService";
import { registerSocketRouter, V3_NAMESPACE } from "./socketRouter";

const ws_url = import.meta.env.VITE_WS_BASE_URL;

export interface ChannelServiceBootstrapResult {
    /** Live v3 socket, or null while the manager is being created /
     *  during token transitions. */
    socket: Socket | null;
}

/**
 * Mount once near the app root, AFTER auth is settled. Pass the
 * current access token, user id and team id (from `myself` in the
 * existing app shell). Re-runs on token, user or team change.
 */
export function useChannelServiceBootstrap(
    accessToken: string | null,
    userId: string | null,
    teamId: string | null
): ChannelServiceBootstrapResult {
    const [socket, setSocket] = useState<Socket | null>(null);

    // Push the latest token / user id / team id into the service
    // synchronously so any `channelService.send(...)` call inside the
    // same render tick sees them set. (The socket lands a tick later via
    // the effect.)
    channelService.setAccessToken(accessToken);
    channelService.setCurrentUserId(userId);
    // Same push, for the non-React module that loads protected `/media/`
    // attachments: an `<img>` can't carry a header, so without this the
    // picture is at the mercy of whatever `refresh` cookie the browser
    // decides to attach (`utils/mediaAuth`).
    setMediaAccessToken(accessToken);
    // Before the effect, so the reset lands ahead of the socket teardown
    // below rather than a tick after it — otherwise events for the old
    // team could still be applied into the new team's store.
    channelService.setCurrentTeamId(teamId);

    useEffect(() => {
        if (!accessToken) {
            // Not signed in — leave the service idle. Any prior socket
            // gets cleaned up by the unmount path of the previous run.
            return;
        }

        // Open the `/v3` namespace socket. `io(url + ns, opts)` shares
        // a manager with sibling sockets on the same url, so this does
        // not open a second TCP connection in browsers that support
        // websocket multiplexing — Engine.IO multiplexes by namespace
        // tag inside the same long-lived transport.
        const next = io(`${ws_url}${V3_NAMESPACE}`, {
            reconnection: true,
            reconnectionAttempts: 100,
            reconnectionDelay: 5000,
            reconnectionDelayMax: 60000,
            timeout: 100000,
            withCredentials: true,
            // Auth: same dual surface as the legacy socket (header +
            // query). The /v3 connect handler reads both.
            query: {
                userId: userId ?? "",
                // From the argument, not localStorage. The effect now
                // re-runs on team change, and re-reading localStorage
                // here would be a second source of truth that can lag
                // the prop by a render — the socket would join the
                // previous team's `team:{id}` room and keep receiving
                // its broadcasts.
                teamId: teamId ?? "",
                userName: localStorage.getItem("userName") ?? "",
                userEmail: localStorage.getItem("userEmail") ?? "",
            },
            extraHeaders: { Authorization: accessToken || "" },
        });

        const unsubscribeRouter = registerSocketRouter(next);
        channelService.setSocket(next);
        setSocket(next);

        // Auto-resync on RECONNECT (not initial connect). The initial
        // socket open is followed by the v3 connect handler joining
        // every channel room AND a separate cold REST load via
        // `listChannels()` / `syncChannel(channelId)`, so triggering
        // a resync at that point is redundant.
        //
        // On reconnect (network blip, laptop sleep, mobile background),
        // the rooms are re-joined but events that fired during the gap
        // are gone — the server doesn't buffer them. `triggerResync()`
        // reads the persisted per-channel checkpoints, sends a single
        // `resync` emit with the earliest as `since`, and applies the
        // batch (which includes top-level messages, thread replies,
        // and hard-deletes), then advances every channel's checkpoint
        // to the envelope's `server_time` so the next `syncChannel`
        // call only pulls truly-new rows.
        //
        // We track `hasConnectedBefore` outside the listener so the
        // first `connect` is a no-op and subsequent ones (reconnects)
        // fire the resync. socket.io-client emits `connect` for both,
        // so this gate is necessary.
        let hasConnectedBefore = false;
        const onConnect = () => {
            if (!hasConnectedBefore) {
                hasConnectedBefore = true;
                // Even on first connect, flush any pending messages
                // that were queued while the socket was constructed
                // but before it finished handshaking. Typically a
                // no-op; matters if the user clicked send during the
                // sub-second handshake window.
                void channelService.flushPendingQueue();
                return;
            }
            // Drain queued/failed pending messages first so the user's
            // typed-during-disconnect sends fire in order, then resync
            // to catch up on missed broadcasts (which includes any
            // messages OTHER users sent in the gap). Order matters:
            // sending our queued backlog before the resync means our
            // own broadcasts come back through `handleMessageCreated`
            // as part of the catch-up loop, naturally consistent.
            void channelService.flushPendingQueue().catch(() => {
                /* per-message failures already recorded as `failed`
                 * pending entries — caller / dev panel surfaces them */
            });
            // `triggerResync` replays missed MESSAGES, but a read cursor
            // that advanced on ANOTHER device while this one was
            // disconnected is not in the resync envelope — `read.advanced`
            // is a per-user broadcast the server doesn't buffer. So the
            // chat-list unread badge stayed stale after a reconnect (e.g.
            // read a DM on your phone while the laptop was asleep) until a
            // full page reload. Re-pull the channel list, whose server
            // `unreadCount` is recomputed from the `ReadCursor` — the store
            // notify propagates to the sidebar badge via the existing
            // `channelsVersion` subscription in `useChatManagement`.
            //
            // Chained AFTER the resync (not fired concurrently) so the
            // authoritative server `unreadCount` lands LAST: resync's
            // per-message `_bumpUnread` is optimistic, and letting the exact
            // server count win removes any transient over-count instead of
            // waiting for the next refresh to self-heal it.
            void channelService
                .triggerResync()
                .catch(() => {
                    // Resync failure is non-fatal — the next channel select
                    // will trigger `syncChannel` which fetches the same
                    // window via REST.
                })
                .finally(() => {
                    void channelService.refreshChannels();
                });
        };
        next.on("connect", onConnect);

        // Best-effort cache load. Doesn't block the socket — hooks
        // can start rendering off whatever lands first (cache or live).
        //
        // Pins are then reconciled against the server. IDB alone can't be
        // the source of truth for them: it's empty on a fresh browser or
        // a second device, which is why pinned chats appeared to have been
        // lost. Sequenced after hydration so the fetch reconciles against
        // the cached set rather than racing it.
        //
        // Reminders come from the server every time — they are never
        // cached, never broadcast, and a reminder the user cannot see is
        // one they set twice.
        void channelService.hydrateFromIDB().then(() => {
            void channelService.fetchPins();
            void channelService.fetchReminders();
        });

        return () => {
            next.off("connect", onConnect);
            unsubscribeRouter();
            next.disconnect();
            channelService.setSocket(null);
            setSocket(null);
        };
        // `teamId` is a dependency because the socket's `query.teamId`
        // decides which `team:{id}` room the v3 connect handler joins.
        // Left out, a team switch kept the connection in the previous
        // team's room and re-hydrated its channels from IDB.
    }, [accessToken, userId, teamId]);

    return { socket };
}
