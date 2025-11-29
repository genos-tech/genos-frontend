import { PartialBlock } from "@blocknote/core";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskPreview } from "../../../../../components/editors/bnTaskPreview";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";

type TaskCreateBodyBlockProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    taskId: number;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const TaskCreateBodyBlock = (props: TaskCreateBodyBlockProps) => {
    const { useTEM, myself, setMyself, socket, taskId, body, setBody, useCM, useUISM } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 2 }}>
                <div className="md-content">
                    <BnTaskPreview
                        body={body || []}
                        useCM={useCM}
                        myself={myself}
                        setBody={setBody}
                        setMyself={setMyself}
                        socket={socket}
                        taskId={taskId}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                </div>
            </Box>
        </Stack>
    );
};
