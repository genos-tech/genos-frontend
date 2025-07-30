import { Socket } from "socket.io-client";
import { Box, Stack } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";

type TaskBodyPreviewBlockProps = {
    myself: UserProps;
    socket: Socket | null;
    teamMembers: UserProps[];
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setTaskBodyUpdated: (value: boolean) => void;
    setTaskBodySaved: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const TaskBodyPreviewBlock = (props: TaskBodyPreviewBlockProps) => {
    const {
        myself,
        socket,
        teamMembers,
        body,
        setBody,
        setTaskBodyUpdated,
        setTaskBodySaved,
        setCurrentChat,
        setOpeningService,
    } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 1 }}>
                <BnTaskPreview
                    myself={myself}
                    socket={socket}
                    teamMembers={teamMembers}
                    body={body || []}
                    setBody={setBody}
                    setTaskBodyUpdated={setTaskBodyUpdated}
                    setTaskBodySaved={setTaskBodySaved}
                    setCurrentChat={setCurrentChat}
                    setOpeningService={setOpeningService}
                />
            </Box>
        </Stack>
    );
};
