import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskCommentEditor } from "../../../../../../components/blockNote/bnTaskCommentEditor";
import { BnUpdateTaskCommentEditor } from "../../../../../../components/blockNote/bnUpdateTaskCommentEditor";
import { UserProps } from "../../../../../../types/admin";
import { ChatProps } from "../../../../../../types/chat";
import { TaskCommentProps, TaskProps } from "../../../../../../types/tasks";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";

type TaskCommentEditorBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    task: TaskProps;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    isCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void;
    setCurrentChat: (chat: ChatProps) => void;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
    isInEdit: boolean;
    setIsInEdit: (value: boolean) => void;
    editTargetComment?: TaskCommentProps;
    UIM: UIStateManagementState;
};

export const TaskCommentEditorBlock = (props: TaskCommentEditorBlockProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        task,
        taskComments,
        setTaskComments,
        isCommentUpdated,
        setIsCommentUpdated,
        setCurrentChat,
        UIM,
        taskCommentLines,
        setTaskCommentLines,
        isInEdit,
        setIsInEdit,
        editTargetComment,
    } = props;

    return (
        <Box sx={{ mt: 2 }}>
            {isInEdit === true && editTargetComment && (
                <BnUpdateTaskCommentEditor
                    isCommentUpdated={isCommentUpdated}
                    isInEdit={isInEdit}
                    isPrivate={task.project?.isPrivate}
                    myself={myself}
                    projectId={task.project?.projectId}
                    projectName={task.project?.projectName}
                    setCurrentChat={setCurrentChat}
                    setIsCommentUpdated={setIsCommentUpdated}
                    setIsInEdit={setIsInEdit}
                    setMyself={setMyself}
                    UIM={UIM}
                    setTaskCommentLines={setTaskCommentLines}
                    setTaskComments={setTaskComments}
                    socket={socket}
                    targetComment={editTargetComment}
                    taskCommentLines={taskCommentLines}
                    taskComments={taskComments}
                    taskId={task.id}
                    teamMemberProfiles={teamMemberProfiles}
                    teamMembers={teamMembers}
                />
            )}
            {isInEdit === false && (
                <BnTaskCommentEditor
                    isCommentUpdated={isCommentUpdated}
                    myself={myself}
                    setCurrentChat={setCurrentChat}
                    setIsCommentUpdated={setIsCommentUpdated}
                    setMyself={setMyself}
                    UIM={UIM}
                    setTaskCommentLines={setTaskCommentLines}
                    setTaskComments={setTaskComments}
                    socket={socket}
                    task={task}
                    taskCommentLines={taskCommentLines}
                    taskComments={taskComments}
                    teamMemberProfiles={teamMemberProfiles}
                    teamMembers={teamMembers}
                />
            )}
        </Box>
    );
};
