import { PartialBlock } from "@blocknote/core";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { TaskProps } from "../../../../../types/tasks";

type TaskCreateBodyBlockProps = {
    TEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    taskId: number;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setCurrentChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
};
export const TaskCreateBodyBlock = (props: TaskCreateBodyBlockProps) => {
    const { TEM, myself, setMyself, socket, taskId, body, setBody, setCurrentChat, UIM } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 2 }}>
                <div className="md-content">
                    <BnTaskPreview
                        body={body || []}
                        myself={myself}
                        setBody={setBody}
                        setCurrentChat={setCurrentChat}
                        setMyself={setMyself}
                        UIM={UIM}
                        socket={socket}
                        taskId={taskId}
                        TEM={TEM}
                    />
                </div>
            </Box>
        </Stack>
    );
};
