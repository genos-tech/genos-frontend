import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ModalCreateProject } from "./ModalCreateProject";
import { ModalCreateTag } from "./ModalCreateTag";
import { ModalDeleteProject } from "./ModalDeleteProject";
import { ModalJoinProject } from "./ModalJoinProject";

interface TaskHomeModalsProps {
    myself: UserProps;
    PM: ProjectManagementState;
    TM: TaskManagementState;
    CM: ChatManagementState;
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

export const TaskHomeModals = ({
    myself,
    PM,
    TM,
    CM,
    socket,
    openJoinProject,
    setOpenJoinProject,
    openDeleteProject,
    setOpenDeleteProject,
}: TaskHomeModalsProps) => {
    return (
        <>
            <ModalCreateProject myself={myself} PM={PM} />
            <ModalJoinProject
                CM={CM}
                loadProjectsAndTasks={PM.loadProjectsAndTasks}
                myself={myself}
                openJoinProject={openJoinProject}
                setCurrentProject={PM.setCurrentProject}
                setOpenJoinProject={setOpenJoinProject}
                socket={socket}
            />
            <ModalDeleteProject
                myself={myself}
                openDeleteProject={openDeleteProject}
                PM={PM}
                setOpenDeleteProject={setOpenDeleteProject}
            />
            <ModalCreateTag currentProject={PM.currentProject} myself={myself} TM={TM} />
        </>
    );
};
