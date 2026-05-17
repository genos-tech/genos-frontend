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
};

// Global preview modal for internal links clicked inside chat messages.
// MUI Joy's Modal handles click-outside-to-close and Escape natively
// via `onClose`. Sizing is viewport-relative so the dialog stays usable
// on a wide range of screen sizes without overflowing.
export const UrlLinkModal = (props: UrlLinkModalProps) => {
    const { target, onClose, ...rest } = props;

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
            sx={{ zIndex: 10020 }}
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
                    sx={{
                        "&:hover": {
                            backgroundColor: "rgba(255, 255, 255, 0.85)",
                        },
                        backdropFilter: "blur(6px)",
                        backgroundColor: "rgba(255, 255, 255, 0.6)",
                        right: 12,
                        top: 12,
                        zIndex: 2,
                    }}
                />
                {renderBody()}
            </ModalDialog>
        </Modal>
    );
};
