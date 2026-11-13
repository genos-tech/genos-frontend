import * as React from "react";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { Box, ListDivider, Stack, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { NavItem } from "../../../../../components/ui/nav/NavItem";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../../utils/dateUtils";
import { useActivityStatus } from "../../../hooks/useActivityStatus";
import { aiAppSentence } from "../../../utils/aiAppNotice";

interface AiAppActivityRowProps {
    activity: ActivityMessageProps;
    activityMessages: ActivityMessageProps[];
    myself: UserProps;
    selectedActivityId: string;
    setSelectedActivityId: (value: string) => void;
    useCM: ChatManagementState;
}

/**
 * One "your AI app did X" notice in the Activity feed (MIP-1432).
 *
 * The rows are the member's own doing, so there is no person to show: the app's
 * name leads, the sentence follows (worded here from facts the API stored),
 * and a click opens what was made or changed and marks the row read.
 */
export const AiAppActivityRow: React.FC<AiAppActivityRowProps> = ({
    activity,
    activityMessages,
    myself,
    selectedActivityId,
    setSelectedActivityId,
    useCM,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { accessToken } = useAuth();
    const { updateActivityReadStatus } = useActivityStatus({
        activity,
        activityMessages,
        useCM,
        myself,
        accessToken,
    });
    const notice = activity.aiApp;
    if (!notice) return null;

    const strings = t.chat.activity.aiApp;
    const more = notice.count > 1 ? notice.items.length : 0;
    const url = notice.url;
    // Only an in-app path: the API hands us a path, never a full URL.
    const canOpen = url.startsWith("/") && !url.startsWith("//");

    const onClick = () => {
        setSelectedActivityId(activity.activityId);
        if (canOpen) navigate(url);
        if (activity.isRead === false) updateActivityReadStatus();
    };

    return (
        <React.Fragment>
            <NavItem
                as="div"
                data-chat-list-key={`activity-${activity.activityId}`}
                lines={2}
                selected={selectedActivityId === activity.activityId}
                sx={{ mx: 1, height: "auto", py: 0.75 }}
                unread={activity.isRead === false}
                onClick={onClick}
            >
                <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: "flex-start" }}>
                    <Box
                        sx={{
                            alignItems: "center",
                            bgcolor: "background.level2",
                            borderRadius: "50%",
                            color: "text.secondary",
                            display: "flex",
                            flex: "none",
                            height: 32,
                            justifyContent: "center",
                            width: 32,
                        }}
                        aria-hidden
                    >
                        <SmartToyRoundedIcon fontSize="small" />
                    </Box>
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                            <Typography
                                level="title-sm"
                                sx={{ flex: 1, fontWeight: activity.isRead === false ? 600 : 500 }}
                                noWrap
                            >
                                {notice.app}
                            </Typography>
                            <Typography level="body-xs" sx={{ flex: "none" }}>
                                {extractYYYYMMDDHHMM(activity.tsSent)}
                            </Typography>
                        </Stack>
                        <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>
                            {aiAppSentence(notice, strings)}
                        </Typography>
                        {more > 1 && (
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {notice.items
                                    .slice(0, 3)
                                    .map((i) => i.displayId || i.title)
                                    .filter(Boolean)
                                    .join(", ")}
                                {notice.count > 3 &&
                                    ` ${strings.moreItems.replace("{count}", String(notice.count - 3))}`}
                            </Typography>
                        )}
                    </Stack>
                </Stack>
            </NavItem>
            <ListDivider sx={{ margin: 0, opacity: 0.06 }} />
        </React.Fragment>
    );
};
