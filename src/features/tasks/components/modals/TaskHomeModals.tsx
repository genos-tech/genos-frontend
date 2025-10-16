import { Socket } from "socket.io-client";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { ModalCreateProject } from "./ModalCreateProject";
import { ModalCreateTag } from "./ModalCreateTag";
import { ModalDeleteProject } from "./ModalDeleteProject";
import { ModalJoinProject } from "./ModalJoinProject";

interface TaskHomeModalsProps {
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

export const TaskHomeModals = ({
    myself,
    PM,
    TM,
    allChats,
    setAllChats,
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
                allChats={allChats}
                loadProjectsAndTasks={PM.loadProjectsAndTasks}
                myself={myself}
                openJoinProject={openJoinProject}
                setAllChats={setAllChats}
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
