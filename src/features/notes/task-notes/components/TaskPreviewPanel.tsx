import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelResizeHandle } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskPreview } from "../../../tasks/components/contents/TaskPreview";

type TaskPreviewPanelProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    PM: ProjectManagementState;
    NM: NoteManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};

export const TaskPreviewPanel = (props: TaskPreviewPanelProps) => {
    const { myself, setMyself, UIM, socket, TEM, PM, NM, CM, TM } = props;
    const { mode } = useColorScheme();

    if (!NM.currentTaskNoteChain || !NM.isTaskVisibleInNote || !TM.currentPreviewTask) {
        return null;
    }

    return (
        <>
            <PanelResizeHandle
                className="resize-handle"
                style={{
                    width: "1px",
                    backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                    transition: "all 0.3s ease-in-out",
                    cursor: "col-resize",
                }}
            />

            <Panel id={"4"} maxSize={85} minSize={35} order={4}>
                <Box
                    sx={{
                        px: { xs: 1, md: 2 },
                        pt: {
                            xs: "calc(12px + var(--Header-height))",
                            sm: "calc(12px + var(--Header-height))",
                            md: 2,
                        },
                        pb: { xs: 2, sm: 2, md: 3 },
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                        height: "100dvh",
                        gap: 1,
                        boxShadow: "0 0 0 1px grey",
                        borderColor: mode === "dark" ? "black" : "white",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <TaskPreview
                        CM={CM}
                        NM={NM}
                        myself={myself}
                        PM={PM}
                        setMyself={setMyself}
                        socket={socket}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
                    />
                </Box>
            </Panel>
        </>
    );
};
