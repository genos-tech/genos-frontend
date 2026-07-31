import { lazy, Suspense } from "react";
import { CircularProgress, Modal, ModalClose, ModalDialog, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { UserProps } from "../../types/admin";
import { ModalTarget } from "../../utils/parseInternalUrl";

// Lazy on purpose: these views transitively import the chat panes,
// task preview and note editor — the whole BlockNote stack (~900 kB
// gzipped vendor-editor chunk). UrlLinkModal itself is imported
// eagerly by App, so static view imports would pin all of that into
// the initial entry chunk even though a view only ever renders after
// the user clicks an internal link.
const ModalChatView = lazy(() =>
    import("./views/ModalChatView").then((m) => ({ default: m.ModalChatView }))
);
const ModalMilestoneView = lazy(() =>
    import("./views/ModalMilestoneView").then((m) => ({ default: m.ModalMilestoneView }))
);
const ModalNoteView = lazy(() =>
    import("./views/ModalNoteView").then((m) => ({ default: m.ModalNoteView }))
);
const ModalTaskView = lazy(() =>
    import("./views/ModalTaskView").then((m) => ({ default: m.ModalTaskView }))
);
const ModalTodoView = lazy(() =>
    import("./views/ModalTodoView").then((m) => ({ default: m.ModalTodoView }))
);

const ViewLoadingFallback = () => (
    <Stack sx={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <CircularProgress size="md" />
    </Stack>
);

type UrlLinkModalProps = {
    target: ModalTarget | null;
    onClose: () => void;
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
    useTG: UseTodoGroupsState;
    // Stacking override. Defaults to 10020, the chat-message link case.
    // The Spotlight overlay sits at 13100, so the preview opened from a
    // citation inside an answer must pass a higher value (e.g. 13200)
    // to render above the Spotlight sheet.
    zIndex?: number;
};

// Global preview modal for internal links clicked inside chat messages.
// MUI Joy's Modal handles click-outside-to-close and Escape natively
// via `onClose`. Sizing is viewport-relative so the dialog stays usable
// on a wide range of screen sizes without overflowing.
export const UrlLinkModal = (props: UrlLinkModalProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { target, onClose, zIndex, useTG, ...rest } = props;
    const effectiveZIndex = zIndex ?? 10020;

    const renderBody = () => {
        if (!target) return null;
        if (target.kind === "chatMain" || target.kind === "chatThread") {
            // `hostZIndex` lets the thread header lift its MoreMenu +
            // ThreadAskModal above this dialog (they portal to body at
            // layers below it otherwise).
            return <ModalChatView hostZIndex={effectiveZIndex} target={target} {...rest} />;
        }
        if (target.kind === "task") {
            // `hostZIndex` tells the preview it's modal-hosted (header
            // actions adapt) and what layer overlays it spawns (the task
            // diagram) must stack above — see diagramZIndex.ts.
            return (
                <ModalTaskView
                    hostZIndex={effectiveZIndex}
                    target={target}
                    onClose={onClose}
                    {...rest}
                />
            );
        }
        if (target.kind === "milestone") {
            return (
                <ModalMilestoneView
                    hostZIndex={effectiveZIndex}
                    target={target}
                    onClose={onClose}
                    {...rest}
                />
            );
        }
        if (target.kind === "todo") {
            // Narrower prop set than the other views on purpose — the
            // todo pane renders against the shared useTG, not the
            // task/project/note management states.
            return (
                <ModalTodoView
                    accessToken={rest.accessToken}
                    myself={rest.myself}
                    setMyself={rest.setMyself}
                    socket={rest.socket}
                    target={target}
                    useCM={rest.useCM}
                    useTEM={rest.useTEM}
                    useTG={useTG}
                    useUISM={rest.useUISM}
                    onClose={onClose}
                />
            );
        }
        if (
            target.kind === "myNote" ||
            target.kind === "sharedNote" ||
            target.kind === "teamNote" ||
            target.kind === "taskNote" ||
            target.kind === "chatNote"
        ) {
            return (
                <ModalNoteView
                    hostZIndex={effectiveZIndex}
                    target={target}
                    onClose={onClose}
                    {...rest}
                />
            );
        }
        return null;
    };

    // Backdrop matches Joy's default modal scrim but a touch deeper so
    // the dialog reads as floating over the chat. The dialog itself
    // borrows the bubble-style soft shadow + 20px corner radius from
    // elsewhere in the app so the preview doesn't look like a foreign
    // OS dialog.
    return (
        <Modal
            open={target !== null}
            sx={{
                zIndex: effectiveZIndex,
                // Joy pins Select/Autocomplete listbox popups to
                // calc(theme.zIndex.modal + 1) ≈ 1301 and does NOT track the
                // raised `zIndex` above. Left as-is, the task/milestone
                // autocompletes rendered inside these views (assignee,
                // reporter, project, priority, effort, status, sprint…) open
                // at ~1301 — far *behind* this modal — and appear empty. This
                // is exactly what a user opening a task from the task diagram
                // hits: the picker dropdowns show nothing. Re-stamp the var on
                // the modal root (inline listboxes inherit it) and on sibling
                // portaled listboxes so the popups render above the dialog.
                "--unstable_popup-zIndex": effectiveZIndex + 10,
                '& ~ [role="listbox"]': { "--unstable_popup-zIndex": effectiveZIndex + 10 },
            }}
            slotProps={{
                backdrop: {
                    sx: {
                        backdropFilter: "blur(2px)",
                        backgroundColor: "rgba(0, 0, 0, 0.45)",
                    },
                },
            }}
            onClose={onClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={(theme) => ({
                    border: "1px solid",
                    borderColor:
                        theme.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.06)",
                    borderRadius: "20px",
                    boxShadow:
                        theme.palette.mode === "dark"
                            ? "0 24px 60px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35)"
                            : "0 24px 60px rgba(15, 23, 42, 0.22), 0 2px 8px rgba(15, 23, 42, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    height: "min(900px, 88vh)",
                    overflow: "hidden",
                    p: 0,
                    width: "min(1200px, 92vw)",
                })}
            >
                <ModalClose
                    sx={(theme) => {
                        const isDark = theme.palette.mode === "dark";
                        // Hardcoded white-on-white made the ✕ icon disappear
                        // in dark mode (Joy's default icon colour is light
                        // there). Pick a translucent background that
                        // contrasts with the icon for each mode.
                        return {
                            right: 12,
                            top: 12,
                            zIndex: 2,
                            backdropFilter: "blur(6px)",
                            backgroundColor: isDark
                                ? "rgba(15, 15, 22, 0.6)"
                                : "rgba(255, 255, 255, 0.6)",
                            color: isDark ? "rgba(255, 255, 255, 0.92)" : "rgba(15, 23, 42, 0.78)",
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(15, 15, 22, 0.85)"
                                    : "rgba(255, 255, 255, 0.85)",
                                color: isDark ? "rgba(255, 255, 255, 1)" : "rgba(15, 23, 42, 1)",
                            },
                        };
                    }}
                />
                <Suspense fallback={<ViewLoadingFallback />}>{renderBody()}</Suspense>
            </ModalDialog>
        </Modal>
    );
};
