import { Socket } from "socket.io-client";
import { Box, Stack } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";

type TaskBodyBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    taskId: number;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setTaskBodyEdited: (value: boolean) => void;
    setTaskBodySaved: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const TaskBodyBlock = (props: TaskBodyBlockProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        taskId,
        body,
        setBody,
        setTaskBodyEdited,
        setTaskBodySaved,
        setCurrentChat,
        setOpeningService,
    } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 1 }}>
                <BnTaskPreview
                    teamMemberProfiles={teamMemberProfiles}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    teamMembers={teamMembers}
                    taskId={taskId}
                    body={body || []}
                    setBody={setBody}
                    setTaskBodyEdited={setTaskBodyEdited}
                    setTaskBodySaved={setTaskBodySaved}
                    setCurrentChat={setCurrentChat}
                    setOpeningService={setOpeningService}
                />
            </Box>
        </Stack>
    );
};
