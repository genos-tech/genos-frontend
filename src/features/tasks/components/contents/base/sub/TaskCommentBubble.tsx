import EditIcon from "@mui/icons-material/Edit";
import { Avatar, Box, Card, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../../../components/blockNote/bnChatPreview";
import { AvatarWithStatus } from "../../../../../../components/common/avatarWithStatus";
import { EmojiPicker } from "../../../../../../components/emojiInput/EmojiPicker";
import { ReactionTaskCommentEmojiDisplay } from "../../../../../../components/emojiInput/ReactionTaskCommentEmojiDisplay";
import { UserProps } from "../../../../../../types/admin";
import { ChatProps } from "../../../../../../types/chat";
import { ReactionProps } from "../../../../../../types/common";
import { TaskCommentProps } from "../../../../../../types/tasks";
import {
    extractMMDDHHMMSSs,
    extractYYYYMMDDHHMM,
    getLocalCurrentTimestamp,
} from "../../../../../../utils/dateUtils";

type TaskCommentBubbleProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    comment: TaskCommentProps;
    currentProjectId?: number;
    currentProjectName?: string;
    setIsInEdit: (value: boolean) => void;
    setEditTargetComment: (value: TaskCommentProps) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const TaskCommentBubble = (props: TaskCommentBubbleProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        comment,
        currentProjectId,
        currentProjectName,
        setIsInEdit,
        setEditTargetComment,
        setCurrentChat,
        setOpeningService,
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
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number>(0);
    const [pickerRightPosition, setPickerRightPosition] = useState<number>(0);
    useEffect(() => {
        if (boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            setPickerBottomPosition(rect.bottom - 1350);
            setPickerRightPosition(rect.left - 800);
        }
    }, [showEmojiPicker]);

    return (
        <Box ref={boxRef} sx={{ py: 0.5 }}>
            <EmojiPicker
                pickerBottomPosition={pickerBottomPosition}
                pickerRightPosition={pickerRightPosition}
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
            />

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
                                avatarUser={teamMemberProfiles[comment.senderId]}
                                isForBubble={true}
                                isYou={myself.userId === comment.senderId ? true : false}
                                myself={myself}
                                setCurrentMainChat={setCurrentChat}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                socket={socket}
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
                            content={comment.commentBody}
                            customClassName="task-comment-preview"
                            isSent={true}
                            myself={myself}
                            setCurrentChat={setCurrentChat}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                        />
                    </Card>
                </Box>
            )}
        </Box>
    );
};
