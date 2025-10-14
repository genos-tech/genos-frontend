import { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, IconButton, Tooltip } from "@mui/joy";
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
    const [openDeleteMessage, setOpenDeleteMessage] = useState(false);

    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip size="sm" title="Delete">
                <IconButton
                    color={"danger"}
                    size="sm"
                    onClick={() => {
                        setOpenDeleteMessage(true);
                    }}
                >
                    <DeleteIcon />
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
