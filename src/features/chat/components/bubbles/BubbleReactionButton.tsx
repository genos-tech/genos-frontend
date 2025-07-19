import { Tooltip, Box, IconButton } from "@mui/joy";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ReplyIcon from "@mui/icons-material/Reply";
import { UserProps } from "../../../../types/admin";

type BubbleReactionButtonTypes = {
    chatType: number;
    sender: UserProps;
    isLiked: boolean;
    setIsLiked: (value: boolean) => void;
    isSent: boolean;
    replayHandler?: () => void;
};
export const BubbleReactionButton = (props: BubbleReactionButtonTypes) => {
    const { chatType, sender, isLiked, setIsLiked, isSent, replayHandler } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            {replayHandler && (
                <>
                    <Tooltip title="Reply" size="sm">
                        <IconButton
                            component="a"
                            sx={{ "&:hover": { backgroundColor: "transparent" } }}
                            onClick={replayHandler}
                        >
                            <ReplyIcon
                                sx={{
                                    fontSize: 20,
                                    color: isSent ? "background.body" : "neutral.plainColor",
                                }}
                            />
                        </IconButton>
                    </Tooltip>
                </>
            )}

            {!(chatType === 3 && sender.isSystemUser === true) && (
                <>
                    <IconButton
                        component="a"
                        size="sm"
                        onClick={() => setIsLiked(!isLiked)}
                        sx={{
                            backgroundColor: "transparent", // No background
                            outline: "none", // No focus outline
                            padding: 0, // Remove extra space
                            "&:hover": { backgroundColor: "transparent" }, // No hover effect
                            "&:focus, &:focusVisible": { outline: "none", boxShadow: "none" }, // No focus effect
                            "&:active": { transform: "none" }, // Prevents click animation (scaling effect)
                            transition: "none", // No color fade animation
                        }}
                    >
                        {isLiked ? (
                            <FavoriteIcon sx={{ color: "#FF0000", transition: "none" }} /> // Red when liked
                        ) : (
                            <FavoriteBorderIcon sx={{ color: "#888888", transition: "none" }} /> // Gray when not liked
                        )}
                    </IconButton>
                </>
            )}
        </Box>
    );
};
