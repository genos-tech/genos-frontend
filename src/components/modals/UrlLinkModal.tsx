import { Modal, ModalClose, ModalDialog } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ModalTarget } from "../../utils/parseInternalUrl";
import { ModalChatView } from "./views/ModalChatView";

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
        // Phase 2 / 3 kinds fall through to react-router navigation in
        // the dispatcher (useUrlLinkModalState), so we should never
        // receive them here. Render null defensively.
        return null;
    };

    return (
        <Modal open={target !== null} sx={{ zIndex: 10020 }} onClose={onClose}>
            <ModalDialog
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "min(900px, 88vh)",
                    overflow: "hidden",
                    p: 0,
                    width: "min(1200px, 92vw)",
                }}
            >
                <ModalClose sx={{ right: 8, top: 8, zIndex: 1 }} />
                {renderBody()}
            </ModalDialog>
        </Modal>
    );
};
