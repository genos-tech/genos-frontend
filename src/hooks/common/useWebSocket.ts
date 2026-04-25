import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

const ws_url = import.meta.env.VITE_WS_BASE_URL;

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

    const sendHeartBeat = () => {
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
    };

    // Initialize WebSocket connection
    useEffect(() => {
        if (accessToken) {
            console.log("[WS] Start establishing WS connection");
            const _socket = createSocket(accessToken);
            setSocketInstance((prev) => {
                if (prev) {
                    prev.disconnect();
                }
                return _socket;
            });
            console.log("[WS] WS connection established");
        } else {
            console.warn("[WS] No valid access token found");
        }
    }, [myself, accessToken, currentTeamId]);

    // Setup socket events and heartbeat
    useEffect(() => {
        if (socketInstance) {
            socketInstance.emit("join", {
                joiningCGId: -1, // dm_id or gm_id
                joiningCGName: myself.userName, // dm_name or gm_name
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
    }, [socketInstance, myself]);

    return {
        socketInstance,
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

        socket.on("connect", () => {
            console.log("WS connected");
        });

        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
            // alert(`Error: ${data.message}`);
        });

        socket.on("message", async (message) => {
            console.log("message:", message);
        });

        return () => {
            socket.off("message");
            socket.off("connect");
            socket.off("auth_error");
        };
    }, [accessToken]);
};
