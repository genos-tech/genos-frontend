import { Socket } from "socket.io-client";

import { UserProps } from "../../../types/admin";
import { ProjectProps } from "../../../types/tasks";
import { ChatManagementState } from "../../chats/useChatManagement";

export interface WebSocketSyncProps {
    socket: Socket | null;
    accessToken: string | null;
    myself: UserProps;
    isLoading: boolean;
    funcSetInboxItems: () => void;
    currentProject: ProjectProps | null;
    currentPreviewTaskId: number;
    setIsTaskUpdatedBySomeone: (value: boolean) => void;
    setIsTaskCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void;
    useCM: ChatManagementState;
}

export interface MessageContext {
    fromMe: boolean;
    toMe: boolean;
    isEdited: boolean;
    isDeleted: boolean;
    isReactionUpdated: boolean;
}
