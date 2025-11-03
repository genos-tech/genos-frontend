import { PartialBlock } from "@blocknote/core";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { TaskProps } from "../../../../../types/tasks";

type TaskCreateBodyBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    taskId: number;
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setCurrentChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
};
export const TaskCreateBodyBlock = (props: TaskCreateBodyBlockProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        taskId,
        body,
        setBody,
        setCurrentChat,
        UIM,
    } = props;
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
                        teamMemberProfiles={teamMemberProfiles}
                        teamMembers={teamMembers}
                    />
                </div>
            </Box>
        </Stack>
    );
};
