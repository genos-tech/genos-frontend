import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { usePersonalGMTags } from "../../../../hooks/common/usePersonalGMTags";
import { AllChatProps } from "../../../../types/chat";

/**
 * The user's personal tag chips on one GM row. Renders nothing until
 * the store has loaded AND the chat carries at least one tag, so
 * untagged rows never pay the extra height and Virtuoso reflows at most
 * once (when the bundle lands).
 *
 * Rendered by `ChatListItemTitle` as the sub-name line — the same slot
 * a DM row uses for the partner's custom status — so a tagged GM row is
 * exactly as tall as a DM row with a status, instead of adding its own
 * full-width row. Layout: up to 3 chips + a "+N" overflow chip on a
 * single 16px line; when the row shows a lock icon the line is indented
 * to stay aligned with the name (mirrors the custom-status indent).
 */

const MAX_ROW_CHIPS = 3;

export const ChatListItemTags = ({ chat }: { chat: AllChatProps }) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { loaded, tags, assignmentsByChannelId } = usePersonalGMTags();

    if (chat.chatType !== 2 || !loaded) return null;
    const ids = assignmentsByChannelId[chat.chatId];
    if (!ids || ids.length === 0) return null;

    const byId = new Map(tags.map((t) => [t.tagId, t]));
    const rowTags = ids
        .map((id) => byId.get(id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined);
    if (rowTags.length === 0) return null;

    const shown = rowTags.slice(0, MAX_ROW_CHIPS);
    const overflow = rowTags.length - shown.length;

    return (
        <Box
            sx={{
                alignItems: "center",
                display: "flex",
                flexWrap: "nowrap",
                gap: 0.5,
                overflow: "hidden",
                // Align with the name when the lock icon indents it,
                // exactly like the custom-status line in the title.
                pl: chat.isPrivate ? 2.25 : 0,
            }}
        >
            {shown.map((tag) => (
                <Box
                    key={tag.tagId}
                    sx={{
                        alignItems: "center",
                        background: isDark ? `${tag.color}20` : `${tag.color}18`,
                        border: "1px solid",
                        borderColor: `${tag.color}35`,
                        borderRadius: "4px",
                        color: tag.color,
                        display: "inline-flex",
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        height: 16,
                        letterSpacing: "0.02em",
                        lineHeight: 1,
                        maxWidth: 110,
                        overflow: "hidden",
                        px: 0.75,
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {tag.name}
                </Box>
            ))}
            {overflow > 0 && (
                <Box
                    sx={{
                        alignItems: "center",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                        borderRadius: "4px",
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                        display: "inline-flex",
                        flexShrink: 0,
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        height: 16,
                        lineHeight: 1,
                        px: 0.75,
                        whiteSpace: "nowrap",
                    }}
                >
                    +{overflow}
                </Box>
            )}
        </Box>
    );
};
