import React from "react";
import { Box, Typography } from "@mui/joy";

import { AllChatProps } from "../../../types/chat";

interface ChatListItemMessageProps {
    chat: AllChatProps;
}

export const ChatListItemMessage: React.FC<ChatListItemMessageProps> = ({ chat }) => {
    return (
        <Box sx={{ lineHeight: 0, textAlign: "left" }}>
            <Typography
                level="body-sm"
                sx={{
                    ml: "45px",
                    fontWeight: "bold",
                    display: "-webkit-box",
                    WebkitLineClamp: "2",
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {chat.latestMessageText}
            </Typography>
        </Box>
    );
};
