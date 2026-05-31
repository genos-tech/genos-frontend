import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskCommentEditor } from "../../../../../../components/editors/bnTaskCommentEditor";
import { BnUpdateTaskCommentEditor } from "../../../../../../components/editors/bnUpdateTaskCommentEditor";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../../types/admin";
import { TaskCommentProps, TaskProps } from "../../../../../../types/tasks";

type TaskCommentEditorBlockProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    task: TaskProps;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    useCM: ChatManagementState;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
    isInEdit: boolean;
    setIsInEdit: (value: boolean) => void;
    editTargetComment?: TaskCommentProps;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
};

export const TaskCommentEditorBlock = (props: TaskCommentEditorBlockProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        task,
        taskComments,
        setTaskComments,
        useUISM,
        taskCommentLines,
        setTaskCommentLines,
        isInEdit,
        setIsInEdit,
        editTargetComment,
        useCM,
        useTM,
    } = props;

    return (
        <Box sx={{ mt: 2 }}>
            {isInEdit === true && editTargetComment && (
                <BnUpdateTaskCommentEditor
                    isInEdit={isInEdit}
                    isPrivate={task.project?.isPrivate}
                    myself={myself}
                    projectId={task.project?.projectId}
                    projectName={task.project?.projectName}
                    setIsInEdit={setIsInEdit}
                    setMyself={setMyself}
                    setTaskCommentLines={setTaskCommentLines}
                    setTaskComments={setTaskComments}
                    socket={socket}
                    targetComment={editTargetComment}
                    taskCommentLines={taskCommentLines}
                    taskComments={taskComments}
                    taskDisplayId={task.displayId}
                    taskId={task.id}
                    useCM={useCM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />
            )}
            {isInEdit === false && (
                <BnTaskCommentEditor
                    myself={myself}
                    setMyself={setMyself}
                    setTaskCommentLines={setTaskCommentLines}
                    setTaskComments={setTaskComments}
                    socket={socket}
                    task={task}
                    taskCommentLines={taskCommentLines}
                    taskComments={taskComments}
                    useCM={useCM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />
            )}
        </Box>
    );
};
