import AssignmentIcon from "@mui/icons-material/Assignment";
import GroupsIcon from "@mui/icons-material/Groups";

import { BaseAvatar, type BaseAvatarProps } from "./BaseAvatar";

/**
 * The picture of a group chat or a project chat, with nothing around it (MIP-1472).
 *
 * `GMAvatar` / `ProjectAvatar` wrap it in a button that opens the profile modal; a report line
 * and a "chat not loaded yet" placeholder draw it bare. The icon the chat shows when it has no
 * picture is decided here, once, so those places cannot disagree about it.
 */
type ChatKindAvatarProps = Pick<BaseAvatarProps, "size" | "sx"> & {
    /** The picture's URL; no URL (or one that fails to load) shows the icon. */
    src?: string;
};

export const GroupChatAvatar = ({ src, ...rest }: ChatKindAvatarProps) => (
    <BaseAvatar src={src} {...rest}>
        <GroupsIcon />
    </BaseAvatar>
);

export const ProjectChatAvatar = ({ src, ...rest }: ChatKindAvatarProps) => (
    <BaseAvatar src={src} {...rest}>
        <AssignmentIcon />
    </BaseAvatar>
);
