import { ListItemButtonProps } from "@mui/joy/ListItemButton";
import { Socket } from "socket.io-client";

import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";

export interface ChatListItemProps extends ListItemButtonProps {
    // Chat data
    chat: AllChatProps;
    chatType: number;
    allChats: AllChatProps[];

    // User data
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    TEM: TeamManagementState;

    // Current chat state
    currentMainChat?: ChatProps;
    currentSubChat?: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;

    // UI state
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };

    // Services
    socket: Socket | null;
    UIM: UIStateManagementState;
    funcSetAllChats: () => Promise<void>;

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
