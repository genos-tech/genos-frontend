import { useCallback, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

const ws_url = import.meta.env.VITE_WS_BASE_URL;

// How long the socket has to stay down before the banner says anything.
// Socket.io drops and re-handshakes on its own for plenty of ordinary
// reasons — a wifi roam, a laptop waking, a server redeploy — and nearly
// all of those are back inside a second or two. Announcing them turns
// the banner into noise, and a banner that cries wolf is one people stop
// reading. Anything still down after this is worth interrupting for.
const WS_DOWN_GRACE_MS = 5000;
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
            const avatarImgPath: string = localStorage.getItem("avatarImgPath") || "";

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
                    tsLastSeen: getLocalCurrentTimestamp(),
                },
            });
        }
    }, [socketInstance, myself]);

    // Initialize WebSocket connection
    useEffect(() => {
        if (accessToken) {
            const _socket = createSocket(accessToken);
            setSocketInstance((prev) => {
                if (prev) {
                    prev.disconnect();
                }
                return _socket;
            });
        }
    }, [myself, accessToken, currentTeamId]);

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

        const pollId = setInterval(() => {
            if (socketInstance.connected) {
                downSince = null;
                setShowDisconnected(false);
                return;
            }
            if (downSince === null) {
                downSince = Date.now();
                return;
            }
            if (Date.now() - downSince >= WS_DOWN_GRACE_MS) {
                setShowDisconnected(true);
            }
        }, WS_POLL_INTERVAL_MS);

        return () => {
            clearInterval(pollId);
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
