// The name a chat should DISPLAY, as opposed to the `chatName` sitting on its
// row. Two chat kinds have no usable stored name:
//
//   - DM (1): the server keeps `title` blank — the partner IS the title — so
//     `channelToLegacyChat` copies the partner's `userName` into `chatName`.
//     That copy is a snapshot and goes stale on a rename.
//   - MDM (4): never titled, on either side (`_create_group` requires a title
//     only for GM). `chatName` is `""` forever; the name is the member list,
//     derived at render time.
//
// So every surface that shows a chat name derives it instead of printing
// `chatName`: `ChatListItemTitle` for the sidebar row, `HeaderUserName` for
// the main pane. This is that same derivation, extracted pure so the
// notification settings panel can label a MUTED chat with whatever the rest
// of the app calls it — that list used to print a raw chat UUID for exactly
// the two kinds above, because both hand `mute()` an empty name and the
// backend drops an empty label.
//
// Pure (not a hook) so it can run inside a `.map()` over the muted list, and
// unit-tested without mounting a chat pane. Same reason `threadIdentity` and
// `resolveDisplayName` are shaped this way.

import { resolveDisplayName } from "../../../components/ui/avatars/AvatarContext";
import { UserProps } from "../../../types/admin";
import { AllChatProps } from "../../../types/chat";

/** Member names spelled out before collapsing to "+N". Matches `HeaderUserName`. */
const MAX_MDM_NAMES = 3;

/** The subset of a chat row this derivation reads. Widened to `Partial` for
 *  the optional halves so a `ChatProps`, an `AllChatProps`, or a hand-built
 *  `{ chatType, chatName }` all satisfy it. */
export type NameableChat = Pick<AllChatProps, "chatType" | "chatName"> &
    Partial<Pick<AllChatProps, "dmPartnerUser" | "mdmMembers">>;

/**
 * Display name for `chat`, with every partner / member name resolved LIVE
 * (via `resolveDisplayName`) so a rename shows immediately rather than
 * waiting for the chat row to re-sync.
 *
 * Returns `""` when there is genuinely nothing to show — an MDM whose members
 * haven't loaded, a DM whose partner can't be resolved. Callers own that
 * fallback and must NOT print the chat id in its place: `chatId` is a UUID.
 */
export function chatDisplayName(
    chat: NameableChat | undefined,
    myself: UserProps | undefined,
    teamMemberProfiles: Record<string, UserProps> | undefined
): string {
    if (!chat) return "";

    // MDM: comma-joined member names, capped. `mdmMembers` rides only on the
    // `allChats` row, so a caller holding a bare `currentMainChat` gets the
    // `chatName` fallback (i.e. "") — look the row up first when you can.
    if (chat.chatType === 4) {
        const names = (chat.mdmMembers ?? [])
            .map((m) => resolveDisplayName(m.userId, m.userName, myself, teamMemberProfiles))
            .filter((name) => name !== "");
        if (names.length === 0) return chat.chatName || "";
        if (names.length <= MAX_MDM_NAMES) return names.join(", ");
        return `${names.slice(0, MAX_MDM_NAMES).join(", ")} +${names.length - MAX_MDM_NAMES}`;
    }

    // DM: the partner's current name, with the stored snapshot as the fallback
    // for somebody no roster here can name (e.g. another team's user).
    if (chat.chatType === 1 && chat.dmPartnerUser?.userId) {
        return resolveDisplayName(
            chat.dmPartnerUser.userId,
            chat.chatName || "",
            myself,
            teamMemberProfiles
        );
    }

    // GM / PM carry a real server-side title.
    return chat.chatName || "";
}
