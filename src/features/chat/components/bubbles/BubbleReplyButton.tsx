import { Box, Button, Stack } from "@mui/joy";
import CircleIcon from "@mui/icons-material/Circle";

type BubbleReplyButtonTypes = {
    numReplies: number;
    isSent: boolean;
    replayHandler: () => void;
};
export const BubbleReplyButton = (props: BubbleReplyButtonTypes) => {
    const { numReplies, isSent, replayHandler } = props;
    return (
        <Stack
            direction="row"
            sx={{
                justifyContent: isSent ? "flex-end" : "flex-start",
                position: "absolute",
                p: 0.5,
                width: "100%",
                overflow: "hidden", // Prevents unwanted scrollbar
                left: 0, // Ensures full-width alignment
            }}
        >
            <Button
                component="a"
                size="sm"
                variant="plain" // Removes background & border
                onClick={replayHandler}
                sx={{
                    backgroundColor: "transparent",
                    marginLeft: "auto", // Push to right
                    padding: "2px 6px", // Reduce padding for a compact look
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
        </Stack>
    );
};
