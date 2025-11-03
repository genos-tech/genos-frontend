import { PartialBlock } from "@blocknote/core";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";

type TaskBodyBlockProps = {
    TEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    taskId: number;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setTaskBodyEdited: (value: boolean) => void;
    setTaskBodySaved: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
};
export const TaskBodyBlock = (props: TaskBodyBlockProps) => {
    const {
        TEM,
        myself,
        setMyself,
        socket,
        taskId,
        body,
        setBody,
        setTaskBodyEdited,
        setTaskBodySaved,
        setCurrentChat,
        UIM,
    } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 1 }}>
                <BnTaskPreview
                    body={body || []}
                    myself={myself}
                    setBody={setBody}
                    setCurrentChat={setCurrentChat}
                    setMyself={setMyself}
                    UIM={UIM}
                    setTaskBodyEdited={setTaskBodyEdited}
                    setTaskBodySaved={setTaskBodySaved}
                    socket={socket}
                    taskId={taskId}
                    TEM={TEM}
                />
            </Box>
        </Stack>
    );
};
