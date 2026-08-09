import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { IconButton, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useMentionGroupModal } from "../../context/MentionGroupModalContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { MentionGroupEditor } from "./MentionGroupEditor";

type Props = {
    useTEM: TeamManagementState | undefined;
    // Threaded through to `MentionGroupEditor` for `AvatarWithStatus`.
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};

// Single-group focused modal opened by clicking an @group chip inside
// any BlockNote editor or preview. Subscribes to
// `MentionGroupModalContext` for the open/closed state, and renders the
// same `MentionGroupEditor` the SettingsModal's mention-groups panel
// uses, so editing behaves identically from either entry point.
export const MentionGroupModal = ({
    useTEM,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const { openGroupId, closeGroupModal } = useMentionGroupModal();
    const open = openGroupId != null;
    return (
        <Modal open={open} onClose={closeGroupModal}>
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="md"
                sx={{
                    width: { xs: "92vw", sm: 520 },
                    maxHeight: "85vh",
                    overflowY: "auto",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <GroupRoundedIcon sx={{ color: "#16a34a" }} />
                    <Typography level="title-md">
                        {t.settings.mentionGroups.modalHeading}
                    </Typography>
                    <Stack sx={{ flex: 1 }} />
                    <IconButton
                        aria-label={t.common.actions.close}
                        size="sm"
                        variant="plain"
                        onClick={closeGroupModal}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                {open && (
                    <MentionGroupEditor
                        groupId={openGroupId!}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        onDeleted={closeGroupModal}
                    />
                )}
            </ModalDialog>
        </Modal>
    );
};
