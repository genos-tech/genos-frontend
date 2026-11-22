import * as React from "react";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { Box, ListDivider, Stack, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { ViaAppIcon } from "../../../../../components/ui/misc/ViaAppIcon";
import { NavItem } from "../../../../../components/ui/nav/NavItem";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../../../hooks/common/UrlLinkModalContext";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../../utils/dateUtils";
import { useActivityStatus } from "../../../hooks/useActivityStatus";
import { aiAppSentence, inAppPath } from "../../../utils/aiAppNotice";

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
 * and a click opens what was made or changed and marks the row read. A task, a milestone and a
 * note each open in the chat's modal (MIP-1755, MIP-1845), the URL staying on the chat; a notice
 * without the ids to open in place goes to its page.
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
    const modal = useUrlLinkModal();
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
    // Only an in-app path: the API hands us a path, never a full URL.
    const url = inAppPath(notice.url);

    // The href of the task or milestone the notice names, built from its ids (MIP-1755). Null when
    // the ids are missing, so the row falls back to its page.
    const itemHref = (): string | null => {
        // A deleted item has nothing left to open: the modal would say "unavailable" (MIP-1923).
        if (notice.verb === "deleted") return null;
        const item = notice.items[0];
        const projectId = item?.projectId ?? null;
        if (!item || projectId == null) return null;
        if (item.kind === "milestone" && item.id != null) {
            return `/workspace/tasks/project/${projectId}/milestone/${item.id}`;
        }
        if (item.kind === "task" && item.taskId != null) {
            return `/workspace/tasks/project/${projectId}/task/${item.taskId}`;
        }
        return null;
    };

    // MIP-1755: a task or a milestone opens in the chat's modal, the same surface a task or milestone
    // link in a chat message opens, not the side pane and not its page. MIP-1845: a note does the same
    // with the note modal. "Open" in the modal goes to the item's page; the URL stays on the chat.
    // The modal hook decides the outcome itself, so there is no second navigation here.
    const openItem = () => {
        const href = notice.kind === "note" ? url : itemHref();
        if (href && modal) {
            modal.openModalByHref(href, { fullPageHref: href });
            return;
        }
        if (url) navigate(url);
    };

    const onClick = () => {
        setSelectedActivityId(activity.activityId);
        if (activity.isRead === false) updateActivityReadStatus();
        openItem();
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
                    {notice.appFamily ? (
                        // The official app's own round mark in place of the robot
                        // (MIP-1571); the same 32px slot, labelled "via Claude" /
                        // "via ChatGPT" (the family only, never the app's name).
                        <ViaAppIcon app={notice.appFamily} size={32} />
                    ) : (
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
                    )}
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
