import React from "react";
import { Box } from "@mui/joy";

import { EmojiText } from "../../../../components/ui/emoji/EmojiText";
import { ViaAppIcon } from "../../../../components/ui/misc/ViaAppIcon";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { AllChatProps } from "../../../../types/chat";
import { derivePreviewMediaKind, MEDIA_LABEL_KEYS } from "../../utils/common";
import { ruleMovePreviewText } from "../../utils/ruleMovePreview";

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

    // A rule's "moved a task" line is stored in English; word it for the viewer.
    const ruleMove = chat.latestMessage?.ruleMove;
    const text = ruleMove
        ? ruleMovePreviewText(ruleMove, t.chat.ruleMoveNotice)
        : chat.latestMessageText;

    // A media-only message (GIF, image, table) stores no preview text,
    // so the row used to render blank. Label it from the body we
    // already have on `latestMessage`.
    const mediaKind = text ? null : derivePreviewMediaKind(chat.latestMessage?.content);

    if (!text && !mediaKind) {
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
            {/* The round mark of the AI app that wrote the latest message (MIP-1570):
                purely visual and inline, so the row's button, hover and tap targets
                are untouched. It leads the line so ellipsis never cuts it off. Only
                a top-level app-made task card can be the latest message (a mirrored
                task comment is a thread reply). */}
            {chat.latestMessage?.viaApp && (
                <Box
                    component="span"
                    sx={{ display: "inline-block", marginInlineEnd: "4px", verticalAlign: "-3px" }}
                >
                    <ViaAppIcon app={chat.latestMessage.viaApp} size={14} />
                </Box>
            )}
            {mediaKind ? (
                t.chat.sidebar[MEDIA_LABEL_KEYS[mediaKind]]
            ) : (
                <bdi className="g-bidi-island">
                    <EmojiText text={text} />
                </bdi>
            )}
        </Box>
    );
};
