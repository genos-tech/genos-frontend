// The places a schedule's report can go, as the picker's rows see them (MIP-2347). Split from
// `ChatTargetOption` so that file exports components only.

import { useHashMentionData } from "../../../context/HashMentionDataContext";
import type { ChatTarget } from "../../../services/schedules";
import { buildAvatarSrc } from "../../../utils/avatarSrc";

/** Most tag chips on a row before a "+N". The Project updates picker caps labels at 2. */
export const MAX_TARGET_TAGS = 2;

/** The Inbox, as a row of the same list: the id is "" because that is how a form says "no chat". */
export type InboxTarget = { id: ""; title: ""; kind: "inbox"; projectId: null };
export const INBOX_TARGET: InboxTarget = { id: "", title: "", kind: "inbox", projectId: null };
/** A chosen place: a chat, or the Inbox row. */
export type DeliverTarget = ChatTarget | InboxTarget;

/** The picture of a target: what the closed field shows beside its name. A project chat shows the
 *  project's own chat image (the project record carries none), a group chat its own. */
export const useChatTargetAvatar = (target: DeliverTarget): string | undefined => {
    const { allChats } = useHashMentionData();
    if (target.kind === "inbox") return undefined;
    if (target.kind === "project") {
        if (target.projectId == null) return undefined;
        const pm = allChats.find(
            (c) => c.chatType === 3 && c.project?.projectId === target.projectId
        );
        return buildAvatarSrc(pm?.profileImagePath);
    }
    const gm = allChats.find((c) => c.chatType === 2 && String(c.chatId) === target.id);
    return buildAvatarSrc(gm?.profileImagePath);
};
