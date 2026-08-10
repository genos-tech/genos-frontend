import { useCallback, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

import { isSnoozedNow } from "../../services/notifications/snooze";
import { PAUSE_CHANGED_EVENT, readSnoozeMirror } from "../../services/notifications/snoozeMirror";
import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { resolveDisplayZone } from "../../utils/userTimezone";
import { PRESENCE_CHANGED_EVENT } from "./presenceEvents";

const ws_url = import.meta.env.VITE_WS_BASE_URL;

// How long a socket we've already seen working has to stay down before
// the banner says anything. Socket.io drops and re-handshakes on its own
// for plenty of ordinary reasons — a wifi roam, a laptop waking, a
// server redeploy — and nearly all of those are back inside a second or
// two. Announcing them turns the banner into noise, and a banner that
// cries wolf is one people stop reading. Anything still down after this
// is worth interrupting for.
const WS_DOWN_GRACE_MS = 5000;

// How long a socket that has never yet connected gets instead. Opening
// the app cold tripped the five-second window every single time, because
// `socket.connected` doesn't flip when the transport is up — it flips
// when the server's connect handler returns, and that handler resolves
// the token, the caller's team list and their project list against
// Django before it acks. Those three round-trips land while the app's
// own boot fetches are queued at the same backend, so several seconds of
// legitimate handshake is the normal case, not an outage. Until we've
// seen the socket up we have nothing to distinguish a slow handshake
// from a real failure, so we wait long enough to cover the slow one.
const WS_FIRST_CONNECT_GRACE_MS = 20000;

const WS_POLL_INTERVAL_MS = 1000;

const createSocket = (accessToken: string | null): Socket => {
    return io(ws_url, {
        reconnection: true,
        reconnectionAttempts: 100,
        reconnectionDelay: 5000,
        reconnectionDelayMax: 60000,
        timeout: 100000,
        withCredentials: true,
        query: {
            teamId: localStorage.getItem("teamId"),
            teamName: localStorage.getItem("teamName"),
            userId: localStorage.getItem("userId"),
            userName: localStorage.getItem("userName"),
            userEmail: localStorage.getItem("userEmail"),
        },
        extraHeaders: {
            Authorization: accessToken || "",
        },
    });
};

export const useWebSocket = (
    accessToken: string | null,
    myself: UserProps,
    currentTeamId: string
) => {
    const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
    const [showDisconnected, setShowDisconnected] = useState(false);

    const sendHeartBeat = useCallback(() => {
        if (socketInstance) {
            const isOfflineForced: string = localStorage.getItem("isOfflineForced") || "false";
            const role: string = localStorage.getItem("role") || "";
            const baseCountry: string = localStorage.getItem("baseCountry") || "";
            const customStatus: string = localStorage.getItem("customStatus") || "";
            // Absolute ISO instant the custom status auto-clears; "" = none.
            // Rides the beat so other users' rosters learn the expiry within a
            // tick and can render "back Tue 9 AM" / mask an elapsed status.
            const customStatusExpiryRaw: string = localStorage.getItem("customStatusExpiry") || "";
            const customStatusExpiry: string | null = customStatusExpiryRaw || null;
            const avatarImgPath: string = localStorage.getItem("avatarImgPath") || "";

            // Slack-style pause, computed FRESH each beat (a schedule window or
            // one-shot can lapse between beats) off the localStorage mirror the
            // pause hook keeps — read here rather than subscribing to the
            // manager, the same way `isOfflineForced` is read. Evaluated in the
            // user's own resolved zone so the schedule branch agrees with the
            // manager. Rides the presence broadcast to other users' avatars.
            const { snoozeUntil, snoozeSchedule } = readSnoozeMirror();
            const isNotificationsPaused = isSnoozedNow(
                snoozeUntil,
                snoozeSchedule,
                resolveDisplayZone(myself, true) ?? "UTC"
            );

            socketInstance.emit("heartbeat", {
                message: "alive",
                is_online: true,
                user: {
                    ...myself,
                    avatarImgPath: avatarImgPath,
                    isOfflineForced: isOfflineForced,
                    role: role,
                    baseCountry: baseCountry,
                    customStatus: customStatus,
                    customStatusExpiry: customStatusExpiry,
                    isNotificationsPaused: isNotificationsPaused,
                    tsLastSeen: getLocalCurrentTimestamp(),
                },
            });
        }
    }, [socketInstance, myself]);

    // A manual pause/resume OR a presence edit (appear-offline, custom status)
    // must reach other users right away, not on the next 60s tick — each edit
    // site fires its event after mutating localStorage, and we answer with an
    // immediate beat carrying the fresh state.
    useEffect(() => {
        const beatNow = () => sendHeartBeat();
        window.addEventListener(PAUSE_CHANGED_EVENT, beatNow);
        window.addEventListener(PRESENCE_CHANGED_EVENT, beatNow);
        return () => {
            window.removeEventListener(PAUSE_CHANGED_EVENT, beatNow);
            window.removeEventListener(PRESENCE_CHANGED_EVENT, beatNow);
        };
    }, [sendHeartBeat]);

    // Initialize WebSocket connection.
    //
    // Keyed on the three things a socket actually carries — the token in
    // its header, and the identity behind its query. Depending on the
    // whole `myself` object meant every unrelated field on it rebuilt the
    // connection: a regenerated `tsLastSeen`, an avatar reconciled
    // against the team-members store, a custom status. None of those
    // change what the server does with the socket, but each one dropped a
    // working connection and paid for a fresh handshake — three blocking
    // Django calls in the connect handler — to arrive back where it
    // started. Waiting for `myself.userId` also skips the throwaway
    // socket that used to open in the ~50ms before identity hydrates, and
    // whose handshake competed with the real one for the same backend.
    //
    // `currentTeamId` stays the team authority rather than
    // `myself.teamId`: `useAppInitialization` advances it only once the
    // team-switch IndexedDB wipe has finished, and the socket is one of
    // the consumers that must not run ahead of that.
    useEffect(() => {
        if (!accessToken || !myself.userId) return;

        const _socket = createSocket(accessToken);
        setSocketInstance((prev) => {
            if (prev) {
                prev.disconnect();
            }
            return _socket;
        });
    }, [accessToken, myself.userId, currentTeamId]);

    // Poll socket.connected status instead of relying on event listeners,
    // because cleanupWebSocketHandlers removes all listeners for shared events.
    //
    // The grace period is measured against the wall clock rather than
    // counted in polls. Counting ticks made the window whatever the
    // browser felt like giving us: a backgrounded tab throttles timers
    // to about one a minute, which stretched a "5 second" wait into
    // several minutes, and the count survived a socket being replaced
    // (it's recreated on team switch), so a fresh socket could inherit
    // an almost-expired counter and flash the banner on its first poll.
    useEffect(() => {
        if (!socketInstance) return;

        // Null while connected; the timestamp we first saw it down otherwise.
        // Local to the effect, so a replaced socket always starts a fresh window.
        let downSince: number | null = null;
        // Whether this socket has ever been observed up, which is what
        // picks between the two windows above.
        let proven = false;

        const pollId = setInterval(() => {
            // Nothing we'd say is being read, and the browser may have
            // suspended the socket behind our back. Neither the outage
            // nor the recovery is ours to judge until the tab is back.
            if (document.hidden) return;

            if (socketInstance.connected) {
                downSince = null;
                proven = true;
                setShowDisconnected(false);
                return;
            }
            if (downSince === null) {
                downSince = Date.now();
                return;
            }
            const grace = proven ? WS_DOWN_GRACE_MS : WS_FIRST_CONNECT_GRACE_MS;
            if (Date.now() - downSince >= grace) {
                setShowDisconnected(true);
            }
        }, WS_POLL_INTERVAL_MS);

        // Coming back to a backgrounded tab, the socket has to re-handshake
        // from scratch and is as slow to answer as it was on the first
        // open — and the hour it spent hidden isn't an hour the user spent
        // waiting. Restart the window from the moment they're actually
        // looking, and ask the connection to prove itself again before we
        // go back to trusting the short one. Measuring against the wall
        // clock made this necessary: the old poll-counting version was
        // accidentally shielded from it by the browser's own throttling.
        const onVisibilityChange = () => {
            if (document.hidden) return;
            downSince = null;
            proven = socketInstance.connected;
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            clearInterval(pollId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
        // `showDisconnected` is deliberately not a dependency: reading it
        // here would tear down and restart the interval every time the
        // banner flips, restarting the very window being measured.
    }, [socketInstance]);

    // Setup heartbeat.
    //
    // The legacy `socket.emit("join", {chatType:1, joiningCGId:-1, ...})`
    // that used to run here was dropped: v3 manages room membership at
    // connect time (connect_handlers auto-subscribe + `channel.subscribe`),
    // and the legacy `"join"` event has had no server handler since the v3
    // migration, so it was a silent no-op.
    useEffect(() => {
        if (socketInstance) {
            sendHeartBeat();

            const intervalId = setInterval(() => {
                sendHeartBeat();
            }, 60_000);

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [socketInstance, sendHeartBeat]);

    return {
        socketInstance,
        showDisconnected,
    };
};

type wsJoinTeamHookProps = {
    socket: Socket | null;
    accessToken: string | null;
};
export const wsJoinTeamHook = (props: wsJoinTeamHookProps) => {
    const { socket, accessToken } = props;

    useEffect(() => {
        if (socket === null) {
            return;
        }

        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
            // alert(`Error: ${data.message}`);
        });

        return () => {
            socket.off("auth_error");
        };
    }, [accessToken]);
};
