import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { buildAvatarSrc } from "../../../utils/avatarSrc";

/**
 * A project's avatar lives on its PM chat (chatType 3) — the project
 * record carries no image of its own. Returns undefined when the chat
 * isn't hydrated or has no image, and callers then fall back to the
 * generic project icon.
 */
export const projectAvatarSrc = (
    projectId: number | undefined,
    allChats: ChatManagementState["allChats"] | undefined
): string | undefined => {
    if (projectId == null || !allChats) return undefined;
    const pmChat = allChats.find(
        (chat) => chat.chatType === 3 && chat.project?.projectId === projectId
    );
    return buildAvatarSrc(pmChat?.profileImagePath);
};
