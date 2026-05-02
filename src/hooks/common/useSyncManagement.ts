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
        setIsTaskUpdatedBySomeone,
        setIsTaskCommentUpdated,
        useCM,
        notificationManager,
    } = props;

    useEffect(() => {
        if (socket === null) {
            console.warn("socket is null");
            return;
        }

        setupWebSocketHandlers(
            socket,
            myself,
            accessToken,
            currentProject,
            currentPreviewTaskId,
            setIsTaskUpdatedBySomeone,
            setIsTaskCommentUpdated,
            funcSetInboxItems,
            useCM,
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
