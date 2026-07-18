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
 * Layout: up to 3 chips + a "+N" overflow chip, single 18px line,
 * left-padded to align under the title (past the 40px avatar column).
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
                pl: 4.5,
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
                        borderRadius: "5px",
                        color: tag.color,
                        display: "inline-flex",
                        fontSize: "0.62rem",
                        fontWeight: 600,
                        height: 18,
                        letterSpacing: "0.02em",
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
                        borderRadius: "5px",
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                        display: "inline-flex",
                        flexShrink: 0,
                        fontSize: "0.62rem",
                        fontWeight: 600,
                        height: 18,
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
