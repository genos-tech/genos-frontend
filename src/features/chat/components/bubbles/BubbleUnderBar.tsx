import { Box, Button, Stack } from "@mui/joy";
import CircleIcon from "@mui/icons-material/Circle";
import { ReactionEmojiDisplay } from "../../../../components/emojiInput/ReactionEmojiDisplay";

type BubbleUnderBarTypes = {
    messageId: number;
    numReplies: number;
    isSent: boolean;
    showUnderBarOption: boolean;
    reactions: string[];
    setReactions: (value: string[]) => void;
    setShowEmojiPicker: (value: boolean) => void;
    replayHandler?: () => void;
    isThread?: boolean;
};
export const BubbleUnderBar = (props: BubbleUnderBarTypes) => {
    const {
        messageId,
        numReplies,
        isSent,
        showUnderBarOption,
        reactions,
        setReactions,
        setShowEmojiPicker,
        replayHandler,
        isThread = false,
    } = props;

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
                    <ReactionEmojiDisplay
                        messageId={messageId}
                        showUnderBarOption={showUnderBarOption}
                        reactions={reactions}
                        setReactions={setReactions}
                        setShowEmojiPicker={setShowEmojiPicker}
                    />
                </Box>

                {isThread == false && numReplies > 0 && (
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
                        {numReplies == 1 ? (
                            <Box sx={{ color: "neutral.plainColor" }}>
                                <CircleIcon sx={{ fontSize: 10 }} color="primary" />
                                &nbsp;
                                {numReplies} reply
                            </Box>
                        ) : (
                            <Box sx={{ color: "neutral.plainColor" }}>{numReplies} replies</Box>
                        )}
                    </Button>
                )}
            </Stack>
        </Box>
    );
};
