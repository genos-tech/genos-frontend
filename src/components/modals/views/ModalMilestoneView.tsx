import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { TaskPreview } from "../../../features/tasks/components/contents/TaskPreview";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { MilestoneTarget } from "../../../utils/parseInternalUrl";
import { useModalLocalTaskComments } from "./useModalLocalTaskComments";

type ModalMilestoneViewProps = {
    target: MilestoneTarget;
    onClose: () => void;
    /** Stacking level of the hosting UrlLinkModal. Forwarded to
     *  TaskPreview so the milestone header's task-graph dialog lifts
     *  above this dialog (see diagramZIndex.ts). */
    hostZIndex?: number;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useSM?: SprintMilestoneManagementState;
};

const CenteredMessage = ({ children }: { children: React.ReactNode }) => (
    <Box
        sx={{
            alignItems: "center",
            display: "flex",
            height: "100%",
            justifyContent: "center",
            p: 4,
            width: "100%",
        }}
    >
        <Typography level="body-md" sx={{ color: "neutral.500" }}>
            {children}
        </Typography>
    </Box>
);

// Renders TaskPreview in its milestone mode against modal-local preview
// state so the host page's `useTM.currentPreviewKind` / preview ids stay
// put. TaskPreview switches to <MilestonePreviewInner> when
// `currentPreviewKind === "milestone"` and `currentPreviewMilestoneId`
// is set — we force both via `useTMOverride`.
//
// Two things the milestone path needs that the task path doesn't:
//   1. The milestone must be in `useSM.projectMilestones[projectId]` —
//      MilestonePreviewInner resolves it from that cache, keyed by the
//      *current project's* id. We `refreshMilestone` (which upserts the
//      cache) and gate render on it so the body doesn't flash empty.
//   2. That lookup uses `usePM.currentProject?.projectId`, so a link to
//      a milestone in a non-current project would miss. We override
//      `currentProject` to the target's project (from `teamProjects`).
//
// Known limitation (same as the chat / task / note views): the modal is
// a snapshot at load time; close + reopen to refetch.
export const ModalMilestoneView = (props: ModalMilestoneViewProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const {
        target,
        onClose,
        hostZIndex,
        myself,
        setMyself,
        socket,
        useTEM,
        useUISM,
        useCM,
        useTM,
        usePM,
        useNM,
        useSM,
    } = props;

    const { t } = useTranslation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Modal-local comment slots — see the hook's doc comment. Declared
    // unconditionally (before the early returns) per rules-of-hooks.
    const localTaskComments = useModalLocalTaskComments();

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setErrorMessage(null);

        if (!useSM) {
            setErrorMessage(t.common.modalView.milestoneUnavailable);
            setIsLoading(false);
            return;
        }

        (async () => {
            try {
                const milestone = await useSM.refreshMilestone(target.milestoneId);
                if (cancelled) return;
                if (!milestone) {
                    setErrorMessage(t.common.modalView.milestoneUnavailable);
                    setIsLoading(false);
                    return;
                }
                setIsLoading(false);
            } catch (e) {
                if (!cancelled) {
                    console.error("ModalMilestoneView load failed:", e);
                    setErrorMessage(t.common.modalView.milestoneLoadFailed);
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // `useSM` is a hook-state object whose identity changes every
        // render — depending on it would re-run the fetch in a loop, so
        // we key only on the milestone id (mirrors ModalChatView).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target.milestoneId]);

    if (errorMessage) return <CenteredMessage>{errorMessage}</CenteredMessage>;
    if (isLoading || !useSM)
        return <CenteredMessage>{t.common.modalView.loadingMilestone}</CenteredMessage>;

    // Point `currentProject` at the milestone's project so
    // MilestonePreviewInner's `projectMilestones[currentProject.projectId]`
    // lookup hits the bucket we just refreshed. Prefer the real project
    // object from `teamProjects`; fall back to the host's current project
    // for the rare cross-team link (the preview then degrades gracefully).
    const modalProject =
        usePM.teamProjects.find((p) => p.projectId === target.projectId) ?? usePM.currentProject;
    const usePMOverride: ProjectManagementState = {
        ...usePM,
        currentProject: modalProject,
    };

    // Force TaskPreview into milestone mode without touching the host
    // page's preview state. `setIsTaskPreviewVisible(false)` (fired by the
    // preview's own close path) routes to the modal's onClose. The
    // comment slots are modal-local for the same reason as ModalTaskView:
    // MilestonePreviewInner loads the backing task's comments through the
    // shared `setTaskComments`, which overwrote the host preview's
    // Comments tab.
    const useTMOverride: TaskManagementState = {
        ...useTM,
        ...localTaskComments,
        currentPreviewKind: "milestone",
        currentPreviewMilestoneId: target.milestoneId,
        setIsTaskPreviewVisible: (visible: boolean) => {
            if (!visible) onClose();
        },
    };

    return (
        <Box
            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
            sx={{ height: "100%", overflow: "auto", width: "100%" }}
        >
            <TaskPreview
                hostZIndex={hostZIndex}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useNM={useNM}
                usePM={usePMOverride}
                useSM={useSM}
                useTEM={useTEM}
                useTM={useTMOverride}
                useUISM={useUISM}
            />
        </Box>
    );
};
