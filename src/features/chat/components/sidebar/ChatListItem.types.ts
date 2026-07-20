import { ListItemButtonProps } from "@mui/joy/ListItemButton";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { ChatListItemLive } from "../../hooks/useChatListItem";

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
    isToDoVisible: boolean;

    /**
     * Whether this row is the open chat. Computed by the LIST, not the
     * row, because it derives from `useCM.currentMainChat` /
     * `currentSubChat` / `isSubChatVisible` — live values. Deriving it
     * inside a memoized row would mean the row could only see them by
     * depending on `useCM`'s identity, which changes every render and
     * defeats the memo entirely. The list re-renders on those changes
     * anyway, so the live dependency belongs there.
     */
    selected: boolean;

    /**
     * Always-current managers, for handlers that read live state at CLICK
     * time (`isSubChatVisible`, `currentSubChat`, `isCreatingTask`). A
     * memoized row can hold those props several notifies stale, and the
     * handlers guard on them — a stale read makes a legitimate click do
     * nothing. Reading `liveRef.current` inside the handler always sees
     * the latest, and the ref's identity is stable so it can't defeat
     * the memo.
     */
    liveRef: React.MutableRefObject<ChatListItemLive>;
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
