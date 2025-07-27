import { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, Card, Avatar, Tooltip, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import EditIcon from "@mui/icons-material/Edit";

import { TaskCommentProps, TaskProps } from "../../../../../types/tasks";
import { BnPreview } from "../../../../../components/blockNote/bnPreview";
import { BnTaskCommentEditor } from "../../../../../components/blockNote/bnTaskCommentEditor";
import { BnUpdateTaskCommentEditor } from "../../../../../components/blockNote/bnUpdateTaskCommentEditor";
import { UserProps } from "../../../../../types/admin";
import { extractMMDDHHMM, extractMMDDHHMMSSs } from "../../../../../utils/dateUtils";

type TaskCommentBlockProps = {
    myself: UserProps;
    socket: Socket | null;
    task: TaskProps;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    isCommentUpdated: boolean;
    setIsCommentUpdated: (value: boolean) => void;
};

export const TaskCommentBlock = (props: TaskCommentBlockProps) => {
    const {
        myself,
        socket,
        task,
        taskComments,
        setTaskComments,
        isCommentUpdated,
        setIsCommentUpdated,
    } = props;
    const { mode } = useColorScheme();
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();
    const [targetCommentIndex, setTargetCommentIndex] = useState<number>(taskComments.length - 1);

    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const box = boxRef.current;
        if (box) {
            box.scrollTop = box.scrollHeight;
        }
    }, [taskComments]); // Re-scroll on content change

    const totalComments = taskComments.reduce(
        (sum, taskComment) => sum + (taskComment.commentBody?.length ?? 0),
        0
    );

    return (
        <Box sx={{ mt: 2 }}>
            <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                Comments
            </Typography>

            <Box sx={{ mb: 1 }}>
                {taskComments.length > 0 && (
                    <>
                        <Box
                            ref={boxRef}
                            className="custom-scrollbar"
                            sx={{
                                height: Math.min(100 + totalComments * 50, 900),
                                pb: "10px",
                                overflowY: "scroll",
                                overflowX: "hidden",
                            }}
                        >
                            <Stack spacing={1}>
                                {taskComments.map((comment, index) => {
                                    const isEdited =
                                        extractMMDDHHMMSSs(comment.tsSent) ===
                                        extractMMDDHHMMSSs(comment.tsUpdated)
                                            ? false
                                            : true;
                                    if (comment.commentBody[0].content.length > 0) {
                                        return (
                                            <Box
                                                key={`${comment.commentId}-${comment.tsUpdated}-${index}`}
                                            >
                                                <Card
                                                    sx={{
                                                        backgroundColor:
                                                            mode === "dark"
                                                                ? "black"
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
                                                            textColor={
                                                                mode === "dark"
                                                                    ? "lightgrey"
                                                                    : "rgba(37, 37, 37, 1)"
                                                            }
                                                            sx={{
                                                                fontFamily: "monospace",
                                                                opacity: 0.7,
                                                                pl: "5px",
                                                            }}
                                                        >
                                                            {isEdited === true && (
                                                                <>
                                                                    {extractMMDDHHMM(
                                                                        comment.tsSent
                                                                    )}{" "}
                                                                    Edited
                                                                </>
                                                            )}
                                                            {isEdited === false && (
                                                                <>
                                                                    {extractMMDDHHMM(
                                                                        comment.tsSent
                                                                    )}
                                                                </>
                                                            )}
                                                        </Typography>
                                                    </Stack>
                                                    <Tooltip title="Edit" size="sm">
                                                        <IconButton
                                                            size="sm"
                                                            onClick={() => {
                                                                setIsInEdit(true);
                                                                setEditTargetComment(comment);
                                                                setTargetCommentIndex(index);
                                                            }}
                                                            sx={{
                                                                position: "absolute",
                                                                top: 5,
                                                                right: 5,
                                                            }}
                                                        >
                                                            <EditIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <BnPreview
                                                        customClassName="task-comment-preview"
                                                        key={`${taskComments[0].taskId}-${comment.commentId}-${comment.tsSent}`}
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

            {isInEdit === true && editTargetComment && (
                <BnUpdateTaskCommentEditor
                    myself={myself}
                    socket={socket}
                    projectId={task.project?.projectId}
                    taskId={task.id}
                    taskComments={taskComments}
                    setTaskComments={setTaskComments}
                    isCommentUpdated={isCommentUpdated}
                    setIsCommentUpdated={setIsCommentUpdated}
                    targetComment={editTargetComment}
                    isInEdit={isInEdit}
                    setIsInEdit={setIsInEdit}
                />
            )}
            {isInEdit === false && (
                <BnTaskCommentEditor
                    myself={myself}
                    socket={socket}
                    task={task}
                    taskComments={taskComments}
                    setTaskComments={setTaskComments}
                    isCommentUpdated={isCommentUpdated}
                    setIsCommentUpdated={setIsCommentUpdated}
                />
            )}
        </Box>
    );
};
