import { Tooltip, Box, IconButton } from "@mui/joy";
import DeleteIcon from "@mui/icons-material/Delete";

import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { useState } from "react";
import { ModalDeleteMessage } from "../modals/ModalDeleteMessage";

type BubbleDeleteButtonTypes = {
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
            <Tooltip title="Delete" size="sm">
                <IconButton
                    size="sm"
                    color={"danger"}
                    onClick={() => {
                        setOpenDeleteMessage(true);
                    }}
                >
                    <DeleteIcon />
                </IconButton>
            </Tooltip>

            <ModalDeleteMessage
                openDeleteMessage={openDeleteMessage}
                setOpenDeleteMessage={setOpenDeleteMessage}
                message={message}
                accessToken={accessToken}
                isThread={isThread}
                currentChat={currentChat}
                setCurrentChat={setCurrentChat}
                currentThreadChat={currentThreadChat}
                setCurrentThreadChat={setCurrentThreadChat}
            />
        </Box>
    );
};
