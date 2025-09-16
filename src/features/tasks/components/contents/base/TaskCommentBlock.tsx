import { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { useScrollToBottomOnNewTaskComment } from "../../../hooks/taskCommentHooks";
import { TaskCommentProps, TaskProps } from "../../../../../types/tasks";
import { BnTaskCommentEditor } from "../../../../../components/blockNote/bnTaskCommentEditor";
import { BnUpdateTaskCommentEditor } from "../../../../../components/blockNote/bnUpdateTaskCommentEditor";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { TaskCommentBubble } from "./sub/TaskCommentBubble";

type TaskCommentBlockProps = {
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
};

export const TaskCommentBlock = (props: TaskCommentBlockProps) => {
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
    } = props;
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
            if (node.content[0]) {
                if (node.content[0].text) {
                    count += node.content[0].text.split("\n").length;
                }
            }
        }
        return count;
    };

    const totalComments = taskComments.reduce(
        (sum, taskComment) => sum + (countLines(taskComment.commentBody) ?? 0),
        0
    );

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewTaskComment(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        taskComments,
        isCommentUpdated.scrollToBottom
    );

    return (
        <Box sx={{ mt: 2 }}>
            <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                Comments
            </Typography>

            {taskComments.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    <Virtuoso
                        ref={virtuosoRef}
                        className="custom-scrollbar"
                        style={{ height: Math.min(100 + totalComments * 30, 800) }}
                        totalCount={taskComments.length}
                        initialTopMostItemIndex={taskComments.length - 1}
                        atTopThreshold={64}
                        atBottomThreshold={128}
                        itemContent={(index) => {
                            const comment = taskComments[index];
                            return (
                                <TaskCommentBubble
                                    key={`task-comment-${comment.commentId}-${comment.tsUpdated}`}
                                    teamMemberProfiles={teamMemberProfiles}
                                    socket={socket}
                                    myself={myself}
                                    setMyself={setMyself}
                                    comment={comment}
                                    currentProjectId={task.project?.projectId}
                                    currentProjectName={task.project?.projectName}
                                    setIsInEdit={setIsInEdit}
                                    setEditTargetComment={setEditTargetComment}
                                    setCurrentChat={setCurrentChat}
                                    setOpeningService={setOpeningService}
                                />
                            );
                        }}
                    />
                </Box>
            )}

            {isInEdit === true && editTargetComment && (
                <BnUpdateTaskCommentEditor
                    teamMemberProfiles={teamMemberProfiles}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    teamMembers={teamMembers}
                    projectId={task.project?.projectId}
                    projectName={task.project?.projectName}
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
