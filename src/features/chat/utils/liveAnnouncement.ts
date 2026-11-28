import { isInMainTimeline, type Message } from "../../../types/channel";
import type { PreviewMediaKind } from "../../../types/chat";
import { derivePreviewMediaKind, MEDIA_LABEL_KEYS } from "./common";

/** Where the announcer listens: the open conversation, a thread inside it, or neither. */
export type AnnouncerScope = { chatId: string; threadId?: string };

/** How long a preview may get before it is cut: a screen reader reads all of it aloud. */
export const ANNOUNCE_PREVIEW_MAX = 100;

/** A message is announced only in the pane it belongs to (not in other chats, not a thread's
 *  replies in the main pane, not the main pane's messages in a thread). */
export const matchesConversation = (m: Message, scope: AnnouncerScope): boolean =>
    scope.threadId
        ? m.isThreadReply && m.threadRootId === scope.threadId
        : isInMainTimeline(m) && m.channelId === scope.chatId;

type PreviewLabels = {
    attachment: string;
    media: Record<PreviewMediaKind, string>;
};

/** The text of the message in one short line: whitespace collapsed, cut at the limit; a message
 *  with no text says what it carries (the chat list's own labels), else "an attachment". */
export const previewForAnnouncement = (m: Message, labels: PreviewLabels): string => {
    const text = (m.bodyText ?? "").replace(/\s+/g, " ").trim();
    if (text === "") {
        const kind = derivePreviewMediaKind(m.body);
        return kind ? labels.media[kind] : labels.attachment;
    }
    return text.length > ANNOUNCE_PREVIEW_MAX
        ? `${text.slice(0, ANNOUNCE_PREVIEW_MAX - 1).trimEnd()}…`
        : text;
};

export { MEDIA_LABEL_KEYS };
