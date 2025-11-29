import { Box, Button, Stack } from "@mui/joy";
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
    showUnderBarOption: boolean;
    reactions: ReactionProps[];
    setReactions: (value: ReactionProps[]) => void;
    setUniqueReactionEmojiCount: (value: number) => void;
    setShowEmojiPicker: (value: boolean) => void;
    replayHandler?: () => void;
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
        showUnderBarOption,
        reactions,
        setReactions,
        setUniqueReactionEmojiCount,
        setShowEmojiPicker,
        replayHandler,
        isThread,
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

                {isThread == false && numRepliesWithoutFirstMessage > 0 && (
                    <Button
                        component="a"
                        size="sm"
                        variant="plain" // Removes background & border
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
                        onClick={replayHandler}
                    >
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
