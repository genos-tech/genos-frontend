import { useEffect } from "react";
import { Socket } from "socket.io-client";

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
        };
    }, [accessToken]);
};
