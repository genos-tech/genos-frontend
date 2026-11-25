import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskHomeContent } from "./TaskHomeContent";

type TaskDashboardProps = {
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useSM: SprintMilestoneManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useNM?: NoteManagementState;
    onCloseTaskHome: () => void;
};

export const TaskDashboard = ({
    useTM,
    usePM,
    useTEM,
    useSM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
    useNM,
    onCloseTaskHome,
}: TaskDashboardProps) => {
    return (
        <TaskHomeContent
            myself={myself}
            setMyself={setMyself}
            socket={socket}
            useCM={useCM}
            useNM={useNM}
            usePM={usePM}
            useSM={useSM}
            useTEM={useTEM}
            useTM={useTM}
            useUISM={useUISM}
            onCloseTaskHome={onCloseTaskHome}
        />
    );
};
