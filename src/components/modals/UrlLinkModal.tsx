import { Modal, ModalClose, ModalDialog } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ModalTarget } from "../../utils/parseInternalUrl";
import { ModalChatView } from "./views/ModalChatView";
import { ModalNoteView } from "./views/ModalNoteView";
import { ModalTaskView } from "./views/ModalTaskView";

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
    const { target, onClose, zIndex, ...rest } = props;
    const effectiveZIndex = zIndex ?? 10020;

    const renderBody = () => {
        if (!target) return null;
        if (target.kind === "chatMain" || target.kind === "chatThread") {
            return <ModalChatView target={target} {...rest} />;
        }
        if (target.kind === "task") {
            return <ModalTaskView target={target} onClose={onClose} {...rest} />;
        }
        if (
            target.kind === "myNote" ||
            target.kind === "sharedNote" ||
            target.kind === "taskNote" ||
            target.kind === "chatNote"
        ) {
            return <ModalNoteView target={target} onClose={onClose} {...rest} />;
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
            sx={{ zIndex: effectiveZIndex }}
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
                {renderBody()}
            </ModalDialog>
        </Modal>
    );
};
