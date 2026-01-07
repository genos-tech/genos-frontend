import { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ModalDeleteMessage } from "../modals/ModalDeleteMessage";

type BubbleDeleteButtonTypes = {
    socket: Socket | null;
    accessToken: string | null;
    message: MessageProps | ThreadMessageProps;
    isThread: boolean;
    currentChat?: ChatProps;
    setCurrentChat?: (chat: ChatProps) => void;
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat?: (chat: ThreadProps) => void;
};

export const BubbleDeleteButton = (props: BubbleDeleteButtonTypes) => {
    const {
        socket,
        accessToken,
        message,
        isThread,
        currentChat,
        setCurrentChat,
        currentThreadChat,
        setCurrentThreadChat,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [openDeleteMessage, setOpenDeleteMessage] = useState(false);

    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip
                size="sm"
                title="Delete"
                placement="top"
                sx={{
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                }}
            >
                <IconButton
                    size="sm"
                    onClick={() => {
                        setOpenDeleteMessage(true);
                    }}
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        transition: "all 0.15s ease",
                        color: isDark ? "rgba(248,113,113,0.8)" : "rgba(239,68,68,0.7)",
                        background: "transparent",
                        "&:hover": {
                            background: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)",
                            color: isDark ? "#f87171" : "#ef4444",
                            transform: "scale(1.05)",
                        },
                        "&:active": {
                            transform: "scale(0.95)",
                        },
                    }}
                >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>

            <ModalDeleteMessage
                accessToken={accessToken}
                currentChat={currentChat}
                currentThreadChat={currentThreadChat}
                isThread={isThread}
                message={message}
                openDeleteMessage={openDeleteMessage}
                setCurrentChat={setCurrentChat}
                setCurrentThreadChat={setCurrentThreadChat}
                setOpenDeleteMessage={setOpenDeleteMessage}
                socket={socket}
            />
        </Box>
    );
};
