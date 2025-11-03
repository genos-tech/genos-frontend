import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../../hooks/inbox/useInboxManagement";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { InboxItemProps } from "../../../types/common";

export type InboxHomeProps = {
    TEM: TeamManagementState;
    IM: InboxManagementState;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (me: UserProps) => void;
    CM: ChatManagementState;
    UIM: UIStateManagementState;
};

export type InboxSectionProps = {
    items: InboxItemProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    CM: ChatManagementState;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    itemKeyPrefix: string;
};

export type InboxSectionHeaderProps = {
    title: string;
    unreadCount?: number;
};
