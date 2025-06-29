import { Socket } from "socket.io-client";
import { useEffect, useRef } from "react";
import { Box, Stack, Typography, Card, Avatar } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { TaskCommentProps } from "../../../../../types/tasks";
import { BnPreview } from "../../../../../components/blockNote/bnPreview";
import { BnTaskCommentEditor } from "../../../../../components/blockNote/bnTaskCommentEditor";
import { UserProps } from "../../../../../types/admin";
import { extractMMDDHHMM } from "../../../../../utils/dateUtils";

type TaskCommentBlockProps = {
    myself: UserProps;
    socket: Socket | null;
    projectId: number;
    taskId: number;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    isCommentUpdated: boolean;
    setIsCommentUpdated: (value: boolean) => void;
};

export const TaskCommentBlock = (props: TaskCommentBlockProps) => {
    const {
        myself,
        socket,
        projectId,
        taskId,
        taskComments,
        setTaskComments,
        isCommentUpdated,
        setIsCommentUpdated,
    } = props;

    const { mode } = useColorScheme();

    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const box = boxRef.current;
        if (box) {
            box.scrollTop = box.scrollHeight;
        }
    }, [taskComments]); // Re-scroll on content change

    return (
        <Box sx={{ mt: 2 }}>
            <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                Comments
            </Typography>

            <Box sx={{ mb: 1 }}>
                {taskComments.length === 0 && <div>You can add your comments here !!!</div>}
                {taskComments.length > 0 && (
                    <>
                        <Box
                            ref={boxRef}
                            className="custom-scrollbar"
                            sx={{
                                height: Math.min(taskComments.length * 150, 500),
                                pb: "10px",
                                overflowY: "scroll",
                                overflowX: "hidden",
                            }}
                        >
                            <Stack spacing={1}>
                                {taskComments.map((comment, index) => {
                                    if (comment.commentBody[0].content.length > 0) {
                                        return (
                                            <Box key={index}>
                                                <Card
                                                    sx={{
                                                        backgroundColor:
                                                            mode === "dark"
                                                                ? "grey"
                                                                : "rgb(217, 217, 217)",
                                                    }}
                                                >
                                                    <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        alignItems="center"
                                                    >
                                                        <Avatar size="sm">
                                                            {comment.senderName[0]}
                                                        </Avatar>
                                                        <Typography level="title-md">
                                                            {comment.senderName}
                                                        </Typography>
                                                        <Typography
                                                            level="body-sm"
                                                            textColor="black"
                                                            sx={{
                                                                fontFamily: "monospace",
                                                                opacity: 0.7,
                                                                pl: "5px",
                                                            }}
                                                        >
                                                            {extractMMDDHHMM(comment.sentAt)}
                                                        </Typography>
                                                    </Stack>
                                                    <BnPreview
                                                        customClassName="task-comment-preview"
                                                        key={`${taskComments[0].taskId}-${comment.commentId}-${comment.sentAt}`}
                                                        content={comment.commentBody}
                                                        isSent={true}
                                                    />
                                                </Card>
                                            </Box>
                                        );
                                    }
                                })}
                            </Stack>
                        </Box>
                    </>
                )}
            </Box>

            <BnTaskCommentEditor
                myself={myself}
                socket={socket}
                projectId={projectId}
                taskId={taskId}
                taskComments={taskComments}
                setTaskComments={setTaskComments}
                isCommentUpdated={isCommentUpdated}
                setIsCommentUpdated={setIsCommentUpdated}
            />
        </Box>
    );
};
