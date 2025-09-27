import { Socket } from "socket.io-client";
import { Box, Stack } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";

type TaskCreateBodyBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const TaskCreateBodyBlock = (props: TaskCreateBodyBlockProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        body,
        setBody,
        setCurrentChat,
        setOpeningService,
    } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 2 }}>
                <div className="md-content">
                    <BnTaskPreview
                        teamMemberProfiles={teamMemberProfiles}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        teamMembers={teamMembers}
                        body={body || []}
                        setBody={setBody}
                        setCurrentChat={setCurrentChat}
                        setOpeningService={setOpeningService}
                    />
                </div>
            </Box>
        </Stack>
    );
};
