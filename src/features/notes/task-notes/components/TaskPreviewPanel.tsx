import { Box } from "@mui/joy";
import { Panel } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ResizeHandle } from "../../../../components/ui/ResizeHandle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
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
    useSM?: SprintMilestoneManagementState;
};

export const TaskPreviewPanel = (props: TaskPreviewPanelProps) => {
    const { myself, setMyself, useUISM, socket, useTEM, usePM, useNM, useCM, useTM, useSM } =
        props;

    // A MILESTONE preview leaves `currentPreviewTask` undefined and routes
    // through `currentPreviewKind` instead — `TaskPreview` has its own
    // milestone branch for that. Requiring `currentPreviewTask` therefore
    // unmounted this whole panel the moment the user opened a milestone
    // from here (e.g. clicking "Parent task" up to a milestone backing
    // row), which read as "the milestone doesn't open AND the task I was
    // looking at closes". Accept either shape, matching the gates the task
    // page and the chat page already use.
    const hasMilestonePreview =
        useTM.currentPreviewKind === "milestone" && useTM.currentPreviewMilestoneId != null;
    if (
        !useNM.currentTaskNoteChain ||
        !useNM.isTaskVisibleInNote ||
        (!useTM.currentPreviewTask && !hasMilestonePreview)
    ) {
        return null;
    }

    return (
        <>
            <ResizeHandle />

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
                        height: "var(--app-vh)",
                        gap: 1,
                    }}
                >
                    <TaskPreview
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </Box>
            </Panel>
        </>
    );
};
