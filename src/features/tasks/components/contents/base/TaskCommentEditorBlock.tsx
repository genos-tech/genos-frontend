import { Socket } from "socket.io-client";
import { Box, Typography } from "@mui/joy";

import { TaskCommentProps, TaskProps } from "../../../../../types/tasks";
import { BnTaskCommentEditor } from "../../../../../components/blockNote/bnTaskCommentEditor";
import { BnUpdateTaskCommentEditor } from "../../../../../components/blockNote/bnUpdateTaskCommentEditor";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";

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
    setOpeningService: (value: number) => void;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
    isInEdit: boolean;
    setIsInEdit: (value: boolean) => void;
    editTargetComment?: TaskCommentProps;
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
        setOpeningService,
        taskCommentLines,
        setTaskCommentLines,
        isInEdit,
        setIsInEdit,
        editTargetComment,
    } = props;

    return (
        <Box sx={{ mt: 2 }}>
            <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                Send a Comment
            </Typography>

            {isInEdit === true && editTargetComment && (
                <BnUpdateTaskCommentEditor
                    teamMemberProfiles={teamMemberProfiles}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    teamMembers={teamMembers}
                    projectId={task.project?.projectId}
                    projectName={task.project?.projectName}
                    isPrivate={task.project?.isPrivate}
                    taskId={task.id}
                    taskComments={taskComments}
                    setTaskComments={setTaskComments}
                    isCommentUpdated={isCommentUpdated}
                    setIsCommentUpdated={setIsCommentUpdated}
                    targetComment={editTargetComment}
                    isInEdit={isInEdit}
                    setIsInEdit={setIsInEdit}
                    setCurrentChat={setCurrentChat}
                    setOpeningService={setOpeningService}
                    taskCommentLines={taskCommentLines}
                    setTaskCommentLines={setTaskCommentLines}
                />
            )}
            {isInEdit === false && (
                <BnTaskCommentEditor
                    teamMemberProfiles={teamMemberProfiles}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    teamMembers={teamMembers}
                    task={task}
                    taskComments={taskComments}
                    setTaskComments={setTaskComments}
                    isCommentUpdated={isCommentUpdated}
                    setIsCommentUpdated={setIsCommentUpdated}
                    setCurrentChat={setCurrentChat}
                    setOpeningService={setOpeningService}
                    taskCommentLines={taskCommentLines}
                    setTaskCommentLines={setTaskCommentLines}
                />
            )}
        </Box>
    );
};
