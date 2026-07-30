import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../../hooks/inbox/useInboxManagement";
import { UserProps } from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";

export type InboxHomeProps = {
    useTEM: TeamManagementState;
    useIM: InboxManagementState;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};

export type InboxSectionProps = {
    items: InboxItemProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    itemKeyPrefix: string;
    /**
     * Re-read the inbox after a card changes its own row.
     *
     * Request types 1-4 answer over Socket.IO and get their updated card
     * pushed back, which lands in IndexedDB and re-reads the list.
     * Ownership claims (type 5) answer over HTTP, so nothing else does
     * it — and a row that only flipped in component state is lost the
     * moment Virtuoso recycles it, leaving Approve/Reject live on a
     * request that has already been answered.
     */
    onItemChanged: () => void;
};

export type InboxSectionHeaderProps = {
    title: string;
    unreadCount?: number;
};
