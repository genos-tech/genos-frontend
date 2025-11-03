import { ListItemButtonProps } from "@mui/joy/ListItemButton";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";

export interface ChatListItemProps extends ListItemButtonProps {
    // Chat data
    chat: AllChatProps;

    // User data
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;

    // UI state
    useTM: TaskManagementState;

    // Services
    socket: Socket | null;
    useUISM: UIStateManagementState;

    // Chat specific
    isPinnedChat: boolean;
    incompleteTodoCount: number;
    setIsToDoVisible: (value: boolean) => void;
}

export interface ChatListItemHandlers {
    onClickHandler: () => void;
    splitOpenHandler: () => void;
    pinChatHandler: (chatId: number, chatType: number) => Promise<void>;
}

export interface ChatListItemState {
    isPinned: boolean;
    selected: boolean;
    isYou: boolean;
}
