import React from "react";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AllChatProps } from "../../../../types/chat";

interface ChatListItemMessageProps {
    chat: AllChatProps;
}

export const ChatListItemMessage: React.FC<ChatListItemMessageProps> = ({ chat }) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Check if there are unread messages
    const hasUnread = chat.latestMessage && chat.lastReadMessageId < chat.latestMessage.messageId;

    if (!chat.latestMessageText) {
        return null;
    }

    return (
        <Box sx={{ pl: 4.5 }}>
            <Typography
                level="body-xs"
                sx={{
                    fontWeight: hasUnread ? 600 : 400,
                    fontSize: "0.75rem",
                    color: hasUnread
                        ? isDark
                            ? "rgba(255,255,255,0.75)"
                            : "rgba(0,0,0,0.7)"
                        : isDark
                          ? "rgba(255,255,255,0.45)"
                          : "rgba(0,0,0,0.45)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.4,
                }}
            >
                {chat.latestMessageText}
            </Typography>
        </Box>
    );
};
