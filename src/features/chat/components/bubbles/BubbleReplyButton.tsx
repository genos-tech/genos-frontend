import { Tooltip, Box, IconButton } from "@mui/joy";
import ReplyIcon from "@mui/icons-material/Reply";

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
