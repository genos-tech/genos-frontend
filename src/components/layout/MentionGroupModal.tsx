import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { useTheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useMentionGroupModal } from "../../context/MentionGroupModalContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";
import { UserProps } from "../../types/admin";
import { ModalFrame } from "../ui/modal/ModalFrame";
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
    const { t } = useTranslation();
    const { openGroupId, closeGroupModal } = useMentionGroupModal();
    const open = openGroupId != null;
    const theme = useTheme();
    return (
        <ModalFrame
            icon={<GroupRoundedIcon sx={{ color: g.success.text }} />}
            open={open}
            size="md"
            title={t.settings.mentionGroups.modalHeading}
            // Joy's modal layer, where this dialog has always opened.
            zIndex={theme.zIndex.modal}
            onClose={closeGroupModal}
        >
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
        </ModalFrame>
    );
};
