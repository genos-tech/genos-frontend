import { PartialBlock } from "@blocknote/core";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskPreview } from "../../../../../components/editors/bnTaskPreview";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";

type TaskBodyBlockProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    taskId: number;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setTaskBodyEdited: (value: boolean) => void;
    setTaskBodySaved: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const TaskBodyBlock = (props: TaskBodyBlockProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        taskId,
        body,
        setBody,
        setTaskBodyEdited,
        setTaskBodySaved,
        useCM,
        useUISM,
    } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 1 }}>
                <BnTaskPreview
                    body={body || []}
                    useCM={useCM}
                    myself={myself}
                    setBody={setBody}
                    setMyself={setMyself}
                    setTaskBodyEdited={setTaskBodyEdited}
                    setTaskBodySaved={setTaskBodySaved}
                    socket={socket}
                    taskId={taskId}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Box>
        </Stack>
    );
};
