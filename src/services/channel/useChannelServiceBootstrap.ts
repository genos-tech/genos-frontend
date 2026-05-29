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
 * current access token and the user id (from `myself.userId` in the
 * existing app shell). Re-runs on token change.
 */
export function useChannelServiceBootstrap(
    accessToken: string | null,
    userId: string | null
): ChannelServiceBootstrapResult {
    const [socket, setSocket] = useState<Socket | null>(null);

    // Push the latest token / user id into the service synchronously so
    // any `channelService.send(...)` call inside the same render tick
    // sees them set. (The socket lands a tick later via the effect.)
    channelService.setAccessToken(accessToken);
    channelService.setCurrentUserId(userId);

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
                teamId: localStorage.getItem("teamId") ?? "",
                userName: localStorage.getItem("userName") ?? "",
                userEmail: localStorage.getItem("userEmail") ?? "",
            },
            extraHeaders: { Authorization: accessToken || "" },
        });

        const unsubscribeRouter = registerSocketRouter(next);
        channelService.setSocket(next);
        setSocket(next);

        // Best-effort cache load. Doesn't block the socket — hooks
        // can start rendering off whatever lands first (cache or live).
        void channelService.hydrateFromIDB();

        return () => {
            unsubscribeRouter();
            next.disconnect();
            channelService.setSocket(null);
            setSocket(null);
        };
    }, [accessToken, userId]);

    return { socket };
}
