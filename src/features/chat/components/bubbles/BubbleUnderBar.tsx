import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ShowEmojiReaction } from "../../../../components/ui/emoji/ShowEmojiReaction";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";

type BubbleUnderBarTypes = {
    socket: Socket | null;
    myself: UserProps;
    chatType: number;
    chatName: string;
    dmPartnerUser: UserProps;
    message: MessageProps | ThreadMessageProps;
    numReplies: number;
    // PM-only: task-comment count for the bubble's linked task. PM
    // bubbles surface task comments instead of activity-style thread
    // replies in the under-bar chip. See `MessageProps.taskCommentCount`
    // and `pm_views.py` for where this is computed.
    taskCommentCount?: number;
    showUnderBarOption: boolean;
    reactions: ReactionProps[];
    setReactions: (value: ReactionProps[]) => void;
    setUniqueReactionEmojiCount: (value: number) => void;
    setShowEmojiPicker: (value: boolean) => void;
    replayHandler?: (e?: React.MouseEvent) => void;
    isThread: boolean;
};

export const BubbleUnderBar = (props: BubbleUnderBarTypes) => {
    const {
        socket,
        myself,
        chatType,
        chatName,
        dmPartnerUser,
        message,
        numReplies,
        taskCommentCount,
        showUnderBarOption,
        reactions,
        setReactions,
        setUniqueReactionEmojiCount,
        setShowEmojiPicker,
        replayHandler,
        isThread,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Pick the right counter for this bubble:
    //   - PM (chatType === 3): the task's LIVE comment count
    //     (`taskCommentCount`), i.e. what the thread's Comments tab
    //     shows. NOT `reply_count`/`numReplies`, which counts every
    //     thread reply — it over-counts legacy free-form replies that
    //     were never task comments and under-counts when a comment
    //     mirror failed. Fall back to `numReplies` only for pre-change
    //     IDB-cached rows that predate the server-computed field.
    //   - Other chats: thread replies.
    const isPm = chatType === 3;
    const chipCount = isPm ? (taskCommentCount ?? numReplies ?? 0) : numReplies;
    const chipNoun = isPm ? "comment" : "reply";
    const chipNounPlural = isPm ? "comments" : "replies";

    // Only render if there are reactions or chip-worthy items to show
    const hasReactions = reactions && reactions.length > 0;
    const hasReplies = isThread === false && chipCount > 0;

    if (!hasReactions && !hasReplies) {
        return null;
    }

    return (
        <Box sx={{ mt: 1 }}>
            <Stack
                direction="row"
                sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 0.5,
                }}
            >
                {/* Emoji Reactions */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <ShowEmojiReaction
                        chatName={chatName}
                        chatType={chatType}
                        dmPartnerUser={dmPartnerUser}
                        isThread={isThread}
                        message={message}
                        myself={myself}
                        numReplies={numReplies}
                        reactions={reactions}
                        setReactions={setReactions}
                        setShowEmojiPicker={setShowEmojiPicker}
                        setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                        showUnderBarOption={showUnderBarOption}
                        socket={socket}
                    />
                </Box>

                {/* Reply Counter */}
                {hasReplies && (
                    <Box
                        component="button"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 1,
                            py: 0.5,
                            flexShrink: 0,
                            borderRadius: "8px",
                            border: "1px solid",
                            borderColor: isDark
                                ? "rgba(var(--gp-brand-700-rgb), 0.3)"
                                : "rgba(var(--gp-brand-700-rgb), 0.25)",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.15) 0%, rgba(var(--gp-brand-700-rgb), 0.08) 100%)"
                                : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.12) 0%, rgba(var(--gp-brand-700-rgb), 0.05) 100%)",
                            cursor: "pointer",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                background: isDark
                                    ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.25) 0%, rgba(var(--gp-brand-700-rgb), 0.15) 100%)"
                                    : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brand-700-rgb), 0.1) 100%)",
                                borderColor: isDark
                                    ? "rgba(var(--gp-brand-700-rgb), 0.5)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.4)",
                                transform: "translateY(-1px)",
                                boxShadow: isDark
                                    ? "0 3px 10px rgba(var(--gp-brand-700-rgb), 0.2)"
                                    : "0 3px 10px rgba(var(--gp-brand-700-rgb), 0.15)",
                            },
                            "&:active": {
                                transform: "translateY(0)",
                            },
                        }}
                        onClick={replayHandler}
                    >
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-800)",
                                letterSpacing: "0.01em",
                            }}
                        >
                            {chipCount === 1 ? `1 ${chipNoun}` : `${chipCount} ${chipNounPlural}`}
                        </Typography>
                    </Box>
                )}
            </Stack>
        </Box>
    );
};
