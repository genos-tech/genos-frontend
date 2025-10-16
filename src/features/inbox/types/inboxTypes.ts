import { Socket } from "socket.io-client";

import { Team, UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { InboxItemProps } from "../../../types/common";

export type InboxHomeProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    inboxItems: InboxItemProps[];
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
};

export type InboxSectionProps = {
    items: InboxItemProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    itemKeyPrefix: string;
};

export type InboxSectionHeaderProps = {
    title: string;
    unreadCount?: number;
};
