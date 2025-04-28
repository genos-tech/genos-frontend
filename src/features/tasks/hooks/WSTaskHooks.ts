import { useEffect } from "react";
import { Socket } from "socket.io-client";

type wsTaskHandleHookProps = {
    socket: Socket | null;
    setIsCommentUpdated: (value: boolean) => void;
};

export const wsTaskHandleHook = (props: wsTaskHandleHookProps) => {
    const { socket, setIsCommentUpdated } = props;

    // Web Socket handler
    useEffect(() => {
        if (!socket) return;

        socket.on("connect", () => {
            console.log("WS connected from task home")
        });
        socket.on("disconnect", () => {
            console.log("WS dis-connected from task home")
        });
        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
        });
        socket.on("message", (message) => {
            // console.log("task_comment:", message)
            setIsCommentUpdated(true)
        })
        return () => {
            socket.off("message");
            socket.off("connect");
        };

    }, [socket]);
}