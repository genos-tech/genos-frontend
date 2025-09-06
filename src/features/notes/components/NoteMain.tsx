import { Socket } from "socket.io-client";
import { Box, Stack } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { BnNoteEditor } from "../../../components/blockNote/bnNoteEditor";

type NoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setOpeningService: (service: number) => void;
    setNoteBodyUpdated: (value: boolean) => void;
    setNoteBodySaved: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
};

export const NoteMain = (props: NoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        body,
        setBody,
        setOpeningService,
        setNoteBodyUpdated,
        setNoteBodySaved,
        setCurrentChat,
    } = props;

    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mr: 1 }}>
                <BnNoteEditor
                    teamMemberProfiles={teamMemberProfiles}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    teamMembers={teamMembers}
                    body={body || []}
                    setBody={setBody}
                    setNoteBodyUpdated={setNoteBodyUpdated}
                    setNoteBodySaved={setNoteBodySaved}
                    setCurrentChat={setCurrentChat}
                    setOpeningService={setOpeningService}
                />
            </Box>
        </Stack>
    );
};
