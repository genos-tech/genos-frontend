import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../../hooks/inbox/useInboxManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";

export interface TaskHomeProps {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useIM: InboxManagementState;
    useNM: NoteManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
}

export interface TaskHomeState {
    isTaskTableVisible: boolean;
    isDashboardVisible: boolean;
    filterBy: number;
    selectedTagForFiltering?: string;
    openJoinProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    };
    openDeleteProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
    };
}

export interface TaskHomeActions {
    setIsTaskTableVisible: (visible: boolean) => void;
    setIsDashboardVisible: (visible: boolean) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    setOpenDeleteProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
    }) => void;
}

export interface TaskHomeHeaderProps {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    teamMemberProfiles: any[];
    funcSetAllChats: () => Promise<void>;
    currentProject: any;
    teamTaskSearchOptions: any[];
    loading: boolean;
    openSearch: boolean;
    setOpenSearch: (open: boolean) => void;
    onSearchChange: (value: any) => void;
    handleCreateTask: () => void;
    onCreateProject: () => void;
    onCreateTag: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
    isTaskPreviewVisible: boolean;
    isCreatingTask: boolean;
}

export interface TaskHomeLayoutProps {
    // Layout state
    isTaskTableVisible: boolean;
    isDashboardVisible: boolean;
    filterBy: number;
    selectedTagForFiltering?: string;

    // Management states
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useNM: NoteManagementState;
    useSM: SprintMilestoneManagementState;

    // Props
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
    funcSetAllChats: () => Promise<void>;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    socket: Socket | null;

    // Setters
    setIsTaskTableVisible: (visible: boolean) => void;
    setIsDashboardVisible: (visible: boolean) => void;
}

export interface TaskHomeModalsProps {
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
    socket: Socket | null;
    openJoinProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    };
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    openDeleteProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
    };
    setOpenDeleteProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
    }) => void;
}
