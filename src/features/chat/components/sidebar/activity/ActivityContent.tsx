import React from "react";
import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { EmojiText } from "../../../../../components/ui/emoji/EmojiText";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { GroupedReactionProps } from "../../../../../types/common";
import { MEDIA_LABEL_KEYS } from "../../../utils/common";
import { ActivityReactions } from "./ActivityReactions";

interface ActivityContentProps {
    activity: ActivityMessageProps;
    myself: UserProps;
    groupedReactions: GroupedReactionProps[];
}

export const ActivityContent: React.FC<ActivityContentProps> = ({
    activity,
    myself,
    groupedReactions,
}) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    // A media-only message (GIF, image) has no preview text, so the row
    // would render an empty box. Label it from the media kind the
    // adapter carried over instead.
    const mediaKind = activity.firstLineContent ? undefined : activity.firstLineMediaKind;
    const preview = mediaKind ? (
        t.chat.sidebar[MEDIA_LABEL_KEYS[mediaKind]]
    ) : (
        <EmojiText text={activity.firstLineContent} />
    );

    // For non-reaction activities, show the first line content
    if (activity.activityType !== 2) {
        return (
            <Stack alignItems="flex-start" direction="row" justifyContent="space-between">
                <Box
                    sx={{
                        ml: "44px",
                        py: 0.5,
                        px: 1,
                        borderRadius: "8px",
                        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        maxWidth: "100%",
                    }}
                >
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            fontSize: "0.8rem",
                            lineHeight: 1.5,
                            color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontStyle: mediaKind ? "italic" : "normal",
                            opacity: mediaKind ? 0.75 : 1,
                            wordBreak: "break-word",
                        }}
                    >
                        {preview}
                    </Typography>
                </Box>
            </Stack>
        );
    }

    // For reaction activities, show the reaction display
    return (
        <Box sx={{ mt: 0.25 }}>
            <ActivityReactions
                activity={activity}
                groupedReactions={groupedReactions}
                myself={myself}
            />
            <Box
                sx={{
                    ml: "44px",
                    mt: 0.75,
                    py: 0.5,
                    px: 1,
                    borderRadius: "8px",
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                }}
            >
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 500,
                        fontSize: "0.8rem",
                        lineHeight: 1.5,
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontStyle: "italic",
                        wordBreak: "break-word",
                    }}
                >
                    {preview}
                </Typography>
            </Box>
        </Box>
    );
};
