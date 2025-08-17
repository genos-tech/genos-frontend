import { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, List, Sheet } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { TaskCommentProps, TaskProps } from "../../../../../types/tasks";
import { BnTaskCommentEditor } from "../../../../../components/blockNote/bnTaskCommentEditor";
import { BnUpdateTaskCommentEditor } from "../../../../../components/blockNote/bnUpdateTaskCommentEditor";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { TaskCommentBubble } from "./sub/TaskCommentBubble";

type TaskCommentBlockProps = {
    myself: UserProps;
    socket: Socket | null;
    teamMembers: UserProps[];
    task: TaskProps;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    isCommentUpdated: boolean;
    setIsCommentUpdated: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};

export const TaskCommentBlock = (props: TaskCommentBlockProps) => {
    const {
        myself,
        socket,
        teamMembers,
        task,
        taskComments,
        setTaskComments,
        isCommentUpdated,
        setIsCommentUpdated,
        setCurrentChat,
        setOpeningService,
    } = props;
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    const boxRef = useRef<HTMLDivElement>(null);

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
        }
        return count;
    };

    useEffect(() => {
        const box = boxRef.current;
        if (box) {
            box.scrollTop = box.scrollHeight;
        }
    }, [taskComments]); // Re-scroll on content change

    const totalComments = taskComments.reduce(
        (sum, taskComment) => sum + (countLines(taskComment.commentBody) ?? 0),
        0
    );

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

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
                                    key={`task-comment-${comment.commentId}`}
                                    socket={socket}
                                    myself={myself}
                                    comment={comment}
                                    currentProjectId={task.project?.projectId}
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
                    myself={myself}
                    socket={socket}
                    teamMembers={teamMembers}
                    projectId={task.project?.projectId}
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
                />
            )}
            {isInEdit === false && (
                <BnTaskCommentEditor
                    myself={myself}
                    socket={socket}
                    teamMembers={teamMembers}
                    task={task}
                    taskComments={taskComments}
                    setTaskComments={setTaskComments}
                    isCommentUpdated={isCommentUpdated}
                    setIsCommentUpdated={setIsCommentUpdated}
                    setCurrentChat={setCurrentChat}
                    setOpeningService={setOpeningService}
                />
            )}
        </Box>
    );
};
