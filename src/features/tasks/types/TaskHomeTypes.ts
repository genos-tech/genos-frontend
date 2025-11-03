import { Socket } from "socket.io-client";

import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";
import { TaskType } from "../../../types/tasks";

export interface TaskHomeProps {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
    unReadInboxItemCount: number;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
    funcSetAllChats: () => Promise<void>;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    unReadChatAndActivityCounts: number;
    NM: NoteManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
}

export interface TaskHomeState {
    isTaskHomeVisible: boolean;
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
    setIsTaskHomeVisible: (visible: boolean) => void;
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
    setOpeningService: (service: number) => void;
    openingService: number;
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
    isTaskHomeVisible: boolean;
    isDashboardVisible: boolean;
    filterBy: number;
    selectedTagForFiltering?: string;

    // Management states
    TEM: TeamManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
    NM: NoteManagementState;

    // Props
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
    openingService: number;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
    funcSetAllChats: () => Promise<void>;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    socket: Socket | null;

    // Setters
    setIsTaskHomeVisible: (visible: boolean) => void;
    setIsDashboardVisible: (visible: boolean) => void;
}

export interface TaskHomeModalsProps {
    myself: UserProps;
    PM: ProjectManagementState;
    TM: TaskManagementState;
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
