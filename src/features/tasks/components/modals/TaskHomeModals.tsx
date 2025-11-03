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
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useCM: ChatManagementState;
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
    usePM,
    useTM,
    useCM,
    socket,
    openJoinProject,
    setOpenJoinProject,
    openDeleteProject,
    setOpenDeleteProject,
}: TaskHomeModalsProps) => {
    return (
        <>
            <ModalCreateProject myself={myself} usePM={usePM} />
            <ModalJoinProject
                useCM={useCM}
                myself={myself}
                openJoinProject={openJoinProject}
                setOpenJoinProject={setOpenJoinProject}
                socket={socket}
                usePM={usePM}
            />
            <ModalDeleteProject
                myself={myself}
                openDeleteProject={openDeleteProject}
                usePM={usePM}
                setOpenDeleteProject={setOpenDeleteProject}
            />
            <ModalCreateTag myself={myself} usePM={usePM} useTM={useTM} />
        </>
    );
};
