import ReplyIcon from "@mui/icons-material/Reply";
import { Box, IconButton, Tooltip } from "@mui/joy";

type BubbleReplyButtonTypes = {
    replayHandler: () => void;
};
export const BubbleReplyButton = (props: BubbleReplyButtonTypes) => {
    const { replayHandler } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip size="sm" title="Reply">
                <IconButton size="sm" sx={{}} onClick={replayHandler}>
                    <ReplyIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
};
