import { Socket } from "socket.io-client";

import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { InboxItemProps } from "../../../types/common";

export type InboxHomeProps = {
    TEM: TeamManagementState;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    inboxItems: InboxItemProps[];
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
    UIM: UIStateManagementState;
};

export type InboxSectionProps = {
    items: InboxItemProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    itemKeyPrefix: string;
};

export type InboxSectionHeaderProps = {
    title: string;
    unreadCount?: number;
};
