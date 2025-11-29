import { useEffect, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import { Avatar, Box, Card, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../../../components/editors/bnChatPreview";
import { AvatarWithStatus } from "../../../../../../components/ui/avatars/avatarWithStatus";
import { EmojiPicker } from "../../../../../../components/ui/emoji/EmojiPicker";
import { ReactionTaskCommentEmojiDisplay } from "../../../../../../components/ui/emoji/ReactionTaskCommentEmojiDisplay";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../../types/admin";
import { ReactionProps } from "../../../../../../types/common";
import { TaskCommentProps } from "../../../../../../types/tasks";
import {
    extractMMDDHHMMSSs,
    extractYYYYMMDDHHMM,
    getLocalCurrentTimestamp,
} from "../../../../../../utils/dateUtils";

type TaskCommentBubbleProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    comment: TaskCommentProps;
    currentProjectId?: number;
    currentProjectName?: string;
    setIsInEdit: (value: boolean) => void;
    setEditTargetComment: (value: TaskCommentProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const TaskCommentBubble = (props: TaskCommentBubbleProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        comment,
        currentProjectId,
        currentProjectName,
        setIsInEdit,
        setEditTargetComment,
        useCM,
        useUISM,
    } = props;
    const { mode } = useColorScheme();

    const isEdited =
        extractMMDDHHMMSSs(comment.tsSent) === extractMMDDHHMMSSs(comment.tsUpdated)
            ? false
            : true;

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    useEffect(() => {
        if (comment.reactions) {
            setReactions(comment.reactions);
        }
    }, []);

    useEffect(() => {
        if (comment.reactions) {
            setReactions(comment.reactions);
        }
    }, [comment]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            const existingIndex = reactions.findIndex(
                (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
            );
            if (existingIndex !== -1) {
                // Emoji already exists, remove it
                const updatedReactions = reactions.filter((_, idx) => idx !== existingIndex);
                setReactions(updatedReactions);
                if (socket) {
                    socket.emit("task_comment_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        comment_id: comment.commentId,
                        comment_body: comment.commentBody,
                        comment_sender_id: comment.senderId,
                        comment_sender_name: comment.senderName,
                        reaction_emoji: selectedEmoji,
                    });
                }
            } else {
                // Emoji not in reactions, add it
                setReactions([
                    ...reactions,
                    {
                        id: -1,
                        emoji: selectedEmoji,
                        sender: myself,
                        tsSent: getLocalCurrentTimestamp(),
                    },
                ]);
                if (socket) {
                    socket.emit("task_comment_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        comment_id: comment.commentId,
                        comment_body: comment.commentBody,
                        comment_sender_id: comment.senderId,
                        comment_sender_name: comment.senderName,
                        reaction_emoji: selectedEmoji,
                    });
                }
            }
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    const boxRef = useRef<HTMLDivElement>(null);
    const [pickerTopPosition, setPickerTopPosition] = useState<number | string>("auto");
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number | string>("auto");
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>("auto");
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>("auto");
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);

    useEffect(() => {
        if (showEmojiPicker && boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const pickerHeight = 435; // Approximate height of emoji picker
            const pickerWidth = 352; // Approximate width of emoji picker

            // Calculate vertical position using fixed positioning
            // If there's enough space below, show picker below the comment
            // Otherwise show above
            if (viewportHeight - rect.bottom > pickerHeight + 20) {
                // Show below the comment
                setPickerTopPosition(rect.bottom + 10);
                setPickerBottomPosition("auto");
            } else if (rect.top > pickerHeight + 20) {
                // Show above the comment
                setPickerTopPosition(rect.top - pickerHeight - 10);
                setPickerBottomPosition("auto");
            } else {
                // Not enough space either way, position at top of viewport with some margin
                setPickerTopPosition(20);
                setPickerBottomPosition("auto");
            }

            // Horizontal positioning - align to left edge of comment with some margin
            const leftPos = Math.max(20, Math.min(rect.left, viewportWidth - pickerWidth - 20));
            setPickerLeftPosition(leftPos);
            setPickerRightPosition("auto");
            setEmojiPickerPositionCalculated(true);
        }

        if (showEmojiPicker === false) {
            setEmojiPickerPositionCalculated(false);
        }
    }, [showEmojiPicker]);

    return (
        <Box ref={boxRef} sx={{ py: 0.5 }}>
            {emojiPickerPositionCalculated === true && (
                <EmojiPicker
                    pickerBottomPosition={pickerBottomPosition}
                    pickerLeftPosition={pickerLeftPosition}
                    pickerRightPosition={pickerRightPosition}
                    pickerTopPosition={pickerTopPosition}
                    setSelectedEmoji={setSelectedEmoji}
                    setShowEmojiPicker={setShowEmojiPicker}
                    showEmojiPicker={showEmojiPicker}
                    useFixedPosition={true}
                />
            )}

            {comment.commentBody[0].content.length > 0 && (
                <Box
                    key={`${comment.commentId}-${comment.tsUpdated}`}
                    onMouseEnter={() => setShowUnderBarOption(true)}
                    onMouseLeave={() => setShowUnderBarOption(false)}
                >
                    <Card
                        sx={{
                            backgroundColor:
                                mode === "dark" ? "black" : "rgba(221, 221, 221, 0.45)",
                        }}
                    >
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <AvatarWithStatus
                                avatarUser={useTEM.teamMemberProfiles[comment.senderId]}
                                useCM={useCM}
                                isForBubble={true}
                                isYou={myself.userId === comment.senderId ? true : false}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                useUISM={useUISM}
                            />
                            <Typography level="title-md">{comment.senderName}</Typography>
                            <Typography
                                level="body-sm"
                                textColor={mode === "dark" ? "lightgrey" : "rgba(37, 37, 37, 1)"}
                                sx={{
                                    fontFamily: "monospace",
                                    opacity: 0.7,
                                    pl: "5px",
                                }}
                            >
                                {isEdited === true && (
                                    <>{extractYYYYMMDDHHMM(comment.tsSent)} Edited</>
                                )}
                                {isEdited === false && <>{extractYYYYMMDDHHMM(comment.tsSent)}</>}
                            </Typography>
                        </Stack>
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: -15,
                                right: 10,
                            }}
                        >
                            <ReactionTaskCommentEmojiDisplay
                                comment={comment}
                                myself={myself}
                                projectId={currentProjectId}
                                projectName={currentProjectName}
                                reactions={reactions}
                                setReactions={setReactions}
                                setShowEmojiPicker={setShowEmojiPicker}
                                showUnderBarOption={showUnderBarOption}
                                socket={socket}
                            />
                        </Box>
                        <Tooltip size="sm" title="Edit" variant="outlined">
                            <IconButton
                                size="sm"
                                sx={{
                                    position: "absolute",
                                    top: 5,
                                    right: 5,
                                }}
                                onClick={() => {
                                    setIsInEdit(true);
                                    setEditTargetComment(comment);
                                }}
                            >
                                <EditIcon />
                            </IconButton>
                        </Tooltip>
                        <BnChatPreview
                            key={`${comment.taskId}-${comment.commentId}-${comment.tsSent}`}
                            useCM={useCM}
                            content={comment.commentBody}
                            customClassName="task-comment-preview"
                            isSent={true}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Card>
                </Box>
            )}
        </Box>
    );
};
