import { toast } from "../../../components/ui/feedback/toastStore";
import { getMessages } from "../../../i18n/getMessages";
import { fmt } from "../../../i18n/interpolate";
import { channelService } from "../../../services/channel/channelService";
import { Message } from "../../../types/channel";
import { derivePreviewMediaKind, MEDIA_LABEL_KEYS } from "./common";

export const MESSAGE_PIN_TOAST_ID = "message-pin-action-failed";

/** Pin or unpin for everyone, saying why when the server refuses. */
export const changeMessagePin = async (
    channelId: string,
    messageId: string,
    pinned: boolean
): Promise<void> => {
    try {
        await channelService.setMessagePinned(channelId, messageId, pinned);
    } catch (e) {
        console.error("[messagePins] change failed:", e);
        const t = getMessages().chat.pinnedMessages;
        // The server leads its refusal with a code; genos-sockets passes only the text on.
        const limit = channelService.getSnapshot().messagePinsByChannel.get(channelId)?.limit;
        const text = String((e as Error)?.message ?? "").includes("PIN_LIMIT_REACHED")
            ? fmt(t.limitReached, { count: limit ?? 50 })
            : pinned
              ? t.pinFailed
              : t.unpinFailed;
        toast.error(text, { id: MESSAGE_PIN_TOAST_ID });
    }
};

/** One line of a pinned message for the list: its task id for a project card, then its text,
 *  or a label for what it holds when it has none. */
export const pinnedExcerpt = (message: Message): string => {
    const t = getMessages().chat;
    const kind = derivePreviewMediaKind(message.body);
    const text =
        message.bodyText.trim() ||
        (kind ? t.sidebar[MEDIA_LABEL_KEYS[kind]] : "") ||
        message.attachments
            .map((a) => a.fileName)
            .filter(Boolean)
            .join(", ") ||
        (message.attachments.length > 0 ? t.sidebar.previewFile : "");
    return [message.displayId, text].filter(Boolean).join(" · ");
};
