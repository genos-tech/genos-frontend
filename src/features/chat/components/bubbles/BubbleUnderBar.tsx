import { Socket } from "socket.io-client";
import { Box, Button, Stack } from "@mui/joy";
import CircleIcon from "@mui/icons-material/Circle";

import { ShowEmojiReaction } from "../../../../components/emojiInput/ShowEmojiReaction";
import { UserProps } from "../../../../types/admin";
import { ReactionProps } from "../../../../types/common";
import { MessageProps, ThreadMessageProps } from "../../../../types/chat";

type BubbleUnderBarTypes = {
    socket: Socket | null;
    myself: UserProps;
    chatType: number;
    chatName: string;
    dmPartnerUser: UserProps | null;
    message: MessageProps | ThreadMessageProps;
    numReplies: number;
    isSent: boolean;
    showUnderBarOption: boolean;
    reactions: ReactionProps[];
    setReactions: (value: ReactionProps[]) => void;
    setUniqueReactionEmojiCount: (value: number) => void;
    setShowEmojiPicker: (value: boolean) => void;
    replayHandler?: () => void;
    isThread?: boolean;
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
        isSent,
        showUnderBarOption,
        reactions,
        setReactions,
        setUniqueReactionEmojiCount,
        setShowEmojiPicker,
        replayHandler,
        isThread = false,
    } = props;

    let numRepliesWithoutFirstMessage: number;
    if (chatType !== 3) {
        numRepliesWithoutFirstMessage = numReplies - 1;
    } else {
        numRepliesWithoutFirstMessage = numReplies;
    }

    return (
        <Box sx={{ paddingBottom: "3px", marginBottom: "1px", position: "relative" }}>
            <Stack
                direction="row"
                sx={{
                    justifyContent: "space-between", // 👈 spreads A to left, B to right
                    position: "absolute",
                    p: 0.5,
                    width: "100%",
                    overflow: "hidden",
                    left: 0,
                }}
            >
                <Box>
                    <ShowEmojiReaction
                        socket={socket}
                        myself={myself}
                        chatType={chatType}
                        chatName={chatName}
                        dmPartnerUser={dmPartnerUser}
                        message={message}
                        isThread={isThread}
                        numReplies={numReplies}
                        showUnderBarOption={showUnderBarOption}
                        reactions={reactions}
                        setReactions={setReactions}
                        setShowEmojiPicker={setShowEmojiPicker}
                        setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                    />
                </Box>

                {isThread == false && numRepliesWithoutFirstMessage > 0 && (
                    <Button
                        component="a"
                        size="sm"
                        variant="plain" // Removes background & border
                        onClick={replayHandler}
                        sx={{
                            backgroundColor: "transparent",
                            marginLeft: "auto", // Push to right
                            padding: "10px 6px", // Reduce padding for a compact look
                            minWidth: "auto", // Removes default button width
                            fontSize: "12px", // Makes text smaller
                            textTransform: "none", // Prevents uppercase text
                            "&:hover": {
                                backgroundColor: "transparent",
                                color: "transparent",
                                fontWeight: "bold",
                            },
                        }}
                    >
                        {/* TODO: read/unread for thread replies */}
                        {numRepliesWithoutFirstMessage == 1 ? (
                            <Box sx={{ color: "neutral.plainColor" }}>
                                {/* <CircleIcon sx={{ fontSize: 10 }} color="primary" /> */}
                                &nbsp; 1 reply
                            </Box>
                        ) : (
                            <Box sx={{ color: "neutral.plainColor" }}>
                                {numRepliesWithoutFirstMessage} replies
                            </Box>
                        )}
                    </Button>
                )}
            </Stack>
        </Box>
    );
};
