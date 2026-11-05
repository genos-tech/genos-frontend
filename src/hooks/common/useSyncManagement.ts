import { useEffect } from "react";

import { WebSocketSyncProps } from "./types/websocket-sync";

import { cleanupWebSocketHandlers, setupWebSocketHandlers } from "./handlers/websocket-handlers";

export const webSocketSync = (props: WebSocketSyncProps) => {
    const {
        accessToken,
        socket,
        myself,
        isLoading,
        funcSetInboxItems,
        currentProject,
        currentPreviewTaskId,
        setIsTaskCommentUpdated,
        useCM,
        useTEM,
        notificationManager,
    } = props;

    useEffect(() => {
        if (socket === null) {
            return;
        }

        setupWebSocketHandlers(
            socket,
            myself,
            accessToken,
            currentProject,
            currentPreviewTaskId,
            setIsTaskCommentUpdated,
            funcSetInboxItems,
            useCM,
            useTEM,
            notificationManager
        );

        return () => {
            cleanupWebSocketHandlers(socket);
        };
    }, [
        accessToken,
        isLoading,
        useCM.allChats,
        useCM.currentMainChat,
        useCM.currentSubChat,
        useCM.currentThreadChat,
        notificationManager,
    ]);
};
