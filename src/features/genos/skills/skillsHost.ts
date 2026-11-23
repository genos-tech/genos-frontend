import type { Socket } from "socket.io-client";

import type { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import type { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import type { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import type { UserProps } from "../../../types/admin";

/**
 * What the note editor needs from the app that the Settings dialog is given: who the member is,
 * the socket, and the app-wide state the editor reads (team members for @ mentions, the editor's
 * UI state). The Spotlight gear dialog has none of it, so it shows no Skills card.
 */
export type SkillsHost = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
