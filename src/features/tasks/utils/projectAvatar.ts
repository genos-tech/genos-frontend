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

/**
 * The same rule, resolved for every project in one pass.
 *
 * For hosts that render a LIST of projects and can't reach the chat list
 * from the row itself — the Spotlight / Genos project filter mounts
 * outside the chat provider tree and takes this map as a prop. Calling
 * `projectAvatarSrc` per row would rescan every chat each time, which is
 * the scan `ProjectIdentityRow`'s `avatarSrc` prop exists to avoid.
 *
 * Projects whose PM chat is missing or has no image are absent from the
 * map, so a lookup yields undefined and the row falls back to the
 * generic project icon exactly as before.
 */
export const projectAvatarSrcMap = (
    allChats: ChatManagementState["allChats"] | undefined
): Map<number, string> => {
    const byProjectId = new Map<number, string>();
    for (const chat of allChats ?? []) {
        if (chat.chatType !== 3) continue;
        const projectId = chat.project?.projectId;
        if (projectId == null) continue;
        const src = buildAvatarSrc(chat.profileImagePath);
        if (src) byProjectId.set(projectId, src);
    }
    return byProjectId;
};
