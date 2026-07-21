import AssignmentIcon from "@mui/icons-material/Assignment";
import { Avatar } from "@mui/joy";

import { AllChatProps } from "../../../../types/chat";
import { buildAvatarSrc } from "../../../../utils/avatarSrc";

type SidebarProjectAvatarProps = {
    /** The project's PM channel — carries `profileImagePath`. */
    pmChat: AllChatProps | undefined;
    size?: number;
};

/**
 * The project's avatar, sized for a sidebar folder row.
 *
 * Deliberately presentational, unlike `components/ui/avatars/ProjectAvatar`:
 * that one mounts a `ModalProjectProfile` per instance and opens it on
 * click. Both are wrong here — the task-note section renders one row per
 * project (so we'd mount N modals in the sidebar), and the row's own click
 * has to stay "expand/collapse this folder". The rendered avatar is the
 * same image + `AssignmentIcon` fallback, so the two surfaces match.
 */
export const SidebarProjectAvatar = ({ pmChat, size = 16 }: SidebarProjectAvatarProps) => (
    <Avatar
        size="sm"
        src={buildAvatarSrc(pmChat?.profileImagePath)}
        sx={{ width: size, height: size, flexShrink: 0, "--Avatar-size": `${size}px` }}
    >
        <AssignmentIcon sx={{ fontSize: size - 3 }} />
    </Avatar>
);
