import { PartialBlock } from "@blocknote/core";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";

type TaskCreateBodyBlockProps = {
    TEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    taskId: number;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    CM: ChatManagementState;
    UIM: UIStateManagementState;
};
export const TaskCreateBodyBlock = (props: TaskCreateBodyBlockProps) => {
    const { TEM, myself, setMyself, socket, taskId, body, setBody, CM, UIM } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 2 }}>
                <div className="md-content">
                    <BnTaskPreview
                        body={body || []}
                        CM={CM}
                        myself={myself}
                        setBody={setBody}
                        setMyself={setMyself}
                        socket={socket}
                        taskId={taskId}
                        TEM={TEM}
                        UIM={UIM}
                    />
                </div>
            </Box>
        </Stack>
    );
};
