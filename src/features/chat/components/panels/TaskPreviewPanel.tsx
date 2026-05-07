import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskCommentProps } from "../../../../types/tasks";
import { TaskPreview } from "../../../tasks/components/contents/TaskPreview";

interface TaskPreviewPanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useNM: NoteManagementState;
    myself: UserProps;
    socket: any;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    // Threaded through so TaskPreview's milestone reroute (which gates
    // on `useSM`) can fire when the user opens a task that's actually
    // a milestone backing row — e.g. via the ThreadChatPaneHeader's
    // "Open Task" button on a milestone-tied thread.
    useSM: SprintMilestoneManagementState;
    setTodoFromMessageBubble?: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
}

export const TaskPreviewPanel = ({
    useCM,
    useTM,
    usePM,
    useTEM,
    useNM,
    myself,
    socket,
    setMyself,
    useUISM,
    useSM,
    setTodoFromMessageBubble,
}: TaskPreviewPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"7"} maxSize={70} minSize={30} order={7}>
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
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useTM={useTM}
                    useSM={useSM}
                    useUISM={useUISM}
                    useNM={useNM}
                    usePM={usePM}
                    setTodoFromMessageBubble={setTodoFromMessageBubble}
                />
            </Box>
        </Panel>
    );
};
