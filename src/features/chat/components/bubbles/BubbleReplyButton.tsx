import ReplyIcon from "@mui/icons-material/Reply";
import { Box, IconButton, Tooltip } from "@mui/joy";

type BubbleReplyButtonTypes = {
    replayHandler: () => void;
};
export const BubbleReplyButton = (props: BubbleReplyButtonTypes) => {
    const { replayHandler } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip title="Reply" size="sm">
                <IconButton size="sm" onClick={replayHandler} sx={{}}>
                    <ReplyIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
};
