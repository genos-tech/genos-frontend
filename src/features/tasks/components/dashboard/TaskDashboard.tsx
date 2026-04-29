import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskHomeContent } from "./TaskHomeContent";

type TaskDashboardProps = {
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
};

export const TaskDashboard = ({
    useTM,
    usePM,
    useTEM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
}: TaskDashboardProps) => {
    return (
        <TaskHomeContent
            useTM={useTM}
            usePM={usePM}
            useTEM={useTEM}
            myself={myself}
            setMyself={setMyself}
            useCM={useCM}
            useUISM={useUISM}
            socket={socket}
        />
    );
};
