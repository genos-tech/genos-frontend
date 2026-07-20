import React from "react";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { EmojiText } from "../../../../components/ui/emoji/EmojiText";
import { useTranslation } from "../../../../i18n";
import { AllChatProps } from "../../../../types/chat";
import { derivePreviewMediaKind, PreviewMediaKind } from "../../utils/common";

interface ChatListItemMessageProps {
    chat: AllChatProps;
}

const MEDIA_LABEL_KEYS: Record<
    PreviewMediaKind,
    | "previewGif"
    | "previewImage"
    | "previewVideo"
    | "previewAudio"
    | "previewFile"
    | "previewTable"
> = {
    gif: "previewGif",
    image: "previewImage",
    video: "previewVideo",
    audio: "previewAudio",
    file: "previewFile",
    table: "previewTable",
};

export const ChatListItemMessage: React.FC<ChatListItemMessageProps> = ({ chat }) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

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

    return (
        <Box sx={{ pl: 4.5 }}>
            <Typography
                level="body-xs"
                sx={{
                    fontWeight: hasUnread ? 600 : 400,
                    fontSize: "1rem",
                    fontStyle: mediaKind ? "italic" : "normal",
                    opacity: mediaKind ? 0.75 : 1,
                    color: hasUnread
                        ? isDark
                            ? "rgba(255,255,255,0.95)"
                            : "rgba(0,0,0,0.9)"
                        : isDark
                          ? "rgba(255,255,255,0.7)"
                          : "rgba(0,0,0,0.65)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.4,
                }}
            >
                {mediaKind ? (
                    t.chat.sidebar[MEDIA_LABEL_KEYS[mediaKind]]
                ) : (
                    <EmojiText text={chat.latestMessageText} />
                )}
            </Typography>
        </Box>
    );
};
