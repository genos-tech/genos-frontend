import React from "react";
import { Box } from "@mui/joy";

import { EmojiText } from "../../../../components/ui/emoji/EmojiText";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { AllChatProps } from "../../../../types/chat";
import { derivePreviewMediaKind, MEDIA_LABEL_KEYS } from "../../utils/common";

interface ChatListItemMessageProps {
    chat: AllChatProps;
}

export const ChatListItemMessage: React.FC<ChatListItemMessageProps> = ({ chat }) => {
    const { t } = useTranslation();

    // PUNCH LIST (v3 chatId migration): `lastReadMessageId` is `string`
    // post-flip; `messageId` is still `number`. Round-trip via
    // `Number(... || "0")` — UUID-shaped cursors NaN-compare to false
    // (no false-positive unread dot).
    const hasUnread =
        chat.latestMessage && Number(chat.lastReadMessageId || "0") < chat.latestMessage.messageId;

    // A media-only message (GIF, image, table) stores no preview text,
    // so the row used to render blank. Label it from the body we
    // already have on `latestMessage`.
    const mediaKind = chat.latestMessageText
        ? null
        : derivePreviewMediaKind(chat.latestMessage?.content);

    if (!chat.latestMessageText && !mediaKind) {
        return null;
    }

    // The row's second line (NavItem `secondary`): one line, ellipsized by the
    // row. Unread previews read as text, the rest stay quiet.
    return (
        <Box
            component="span"
            sx={{
                fontStyle: mediaKind ? "italic" : "normal",
                fontWeight: hasUnread ? 500 : 400,
                color: hasUnread ? g.text.primary : "inherit",
            }}
        >
            {mediaKind ? (
                t.chat.sidebar[MEDIA_LABEL_KEYS[mediaKind]]
            ) : (
                <EmojiText text={chat.latestMessageText} />
            )}
        </Box>
    );
};
