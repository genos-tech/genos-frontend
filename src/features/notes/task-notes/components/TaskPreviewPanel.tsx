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
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const TaskPreviewPanel = (props: TaskPreviewPanelProps) => {
    const { myself, setMyself, useUISM, socket, useTEM, usePM, useNM, useCM, useTM } = props;
    const { mode } = useColorScheme();

    if (!useNM.currentTaskNoteChain || !useNM.isTaskVisibleInNote || !useTM.currentPreviewTask) {
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
                        borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                    }}
                >
                    <TaskPreview
                        useCM={useCM}
                        useNM={useNM}
                        myself={myself}
                        usePM={usePM}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </Box>
            </Panel>
        </>
    );
};
