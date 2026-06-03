import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

const ws_url = import.meta.env.VITE_WS_BASE_URL;

const SNACKBAR_DELAY_ATTEMPTS = 5;

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
    const attemptCountRef = useRef(0);

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
    useEffect(() => {
        if (!socketInstance) return;

        const pollId = setInterval(() => {
            if (socketInstance.connected) {
                if (showDisconnected) {
                    setShowDisconnected(false);
                }
                attemptCountRef.current = 0;
            } else {
                attemptCountRef.current += 1;
                if (attemptCountRef.current >= SNACKBAR_DELAY_ATTEMPTS && !showDisconnected) {
                    setShowDisconnected(true);
                }
            }
        }, 1000);

        return () => {
            clearInterval(pollId);
        };
    }, [socketInstance, showDisconnected]);

    // Setup join and heartbeat
    useEffect(() => {
        if (socketInstance) {
            socketInstance.emit("join", {
                joiningCGId: -1,
                joiningCGName: myself.userName,
                chatType: 1,
                dmPartnerUserId: myself.userId,
            });

            sendHeartBeat();

            const intervalId = setInterval(() => {
                sendHeartBeat();
            }, 60_000);

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [socketInstance, myself, sendHeartBeat]);

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
