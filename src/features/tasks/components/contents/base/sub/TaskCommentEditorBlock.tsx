import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskCommentEditor } from "../../../../../../components/blockNote/bnTaskCommentEditor";
import { BnUpdateTaskCommentEditor } from "../../../../../../components/blockNote/bnUpdateTaskCommentEditor";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../../types/admin";
import { TaskCommentProps, TaskProps } from "../../../../../../types/tasks";

type TaskCommentEditorBlockProps = {
    TEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    task: TaskProps;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    CM: ChatManagementState;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
    isInEdit: boolean;
    setIsInEdit: (value: boolean) => void;
    editTargetComment?: TaskCommentProps;
    UIM: UIStateManagementState;
    TM: TaskManagementState;
};

export const TaskCommentEditorBlock = (props: TaskCommentEditorBlockProps) => {
    const {
        TEM,
        myself,
        setMyself,
        socket,
        task,
        taskComments,
        setTaskComments,
        UIM,
        taskCommentLines,
        setTaskCommentLines,
        isInEdit,
        setIsInEdit,
        editTargetComment,
        CM,
        TM,
    } = props;

    return (
        <Box sx={{ mt: 2 }}>
            {isInEdit === true && editTargetComment && (
                <BnUpdateTaskCommentEditor
                    CM={CM}
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
                    taskId={task.id}
                    TEM={TEM}
                    UIM={UIM}
                    TM={TM}
                />
            )}
            {isInEdit === false && (
                <BnTaskCommentEditor
                    CM={CM}
                    myself={myself}
                    setMyself={setMyself}
                    setTaskCommentLines={setTaskCommentLines}
                    setTaskComments={setTaskComments}
                    socket={socket}
                    task={task}
                    taskCommentLines={taskCommentLines}
                    taskComments={taskComments}
                    TEM={TEM}
                    UIM={UIM}
                    TM={TM}
                />
            )}
        </Box>
    );
};
