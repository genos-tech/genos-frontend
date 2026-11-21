import * as React from "react";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { Box, ListDivider, Stack, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { ViaAppIcon } from "../../../../../components/ui/misc/ViaAppIcon";
import { NavItem } from "../../../../../components/ui/nav/NavItem";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { ProjectProps } from "../../../../../types/tasks";
import { extractYYYYMMDDHHMM } from "../../../../../utils/dateUtils";
import { loadSpecificTask } from "../../../../tasks/services/loadSpecificTask";
import { useActivityStatus } from "../../../hooks/useActivityStatus";
import { aiAppSentence, inAppPath } from "../../../utils/aiAppNotice";

interface AiAppActivityRowProps {
    activity: ActivityMessageProps;
    activityMessages: ActivityMessageProps[];
    myself: UserProps;
    selectedActivityId: string;
    setSelectedActivityId: (value: string) => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    setCurrentProject: (project: ProjectProps) => void;
}

/**
 * One "your AI app did X" notice in the Activity feed (MIP-1432).
 *
 * The rows are the member's own doing, so there is no person to show: the app's
 * name leads, the sentence follows (worded here from facts the API stored),
 * and a click opens what was made or changed and marks the row read. A task or a milestone
 * opens in the chat's preview, as a task-body mention does (MIP-1755); a note, or a notice
 * without the ids to open in place, goes to its page.
 */
export const AiAppActivityRow: React.FC<AiAppActivityRowProps> = ({
    activity,
    activityMessages,
    myself,
    selectedActivityId,
    setSelectedActivityId,
    useCM,
    useTM,
    setCurrentProject,
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
    // Only an in-app path: the API hands us a path, never a full URL.
    const url = inAppPath(notice.url);

    // MIP-1755: a task or milestone opens in the chat's preview (the same modal a task-body
    // mention opens), not on its page. Falls back to the page when the ids are missing or the
    // task cannot be loaded.
    const openItem = async () => {
        const item = notice.items[0];
        const projectId = item?.projectId ?? null;
        if (item && projectId != null && item.kind === "milestone" && item.id != null) {
            setCurrentProject({ projectId, projectName: "", projectTags: [] });
            useTM.setCurrentPreviewKind("milestone");
            useTM.setCurrentPreviewMilestoneId(Number(item.id));
            useTM.setIsTaskPreviewVisible(true);
            return;
        }
        if (item && projectId != null && item.kind === "task" && item.taskId != null) {
            const loaded = await loadSpecificTask(myself, projectId, item.taskId, accessToken);
            if (loaded.length > 0) {
                setCurrentProject({ projectId, projectName: "", projectTags: [] });
                useTM.setCurrentPreviewKind("task");
                useTM.setCurrentPreviewTask(loaded[0]);
                useTM.setCurrentPreviewTaskId(item.taskId);
                useTM.setIsTaskPreviewVisible(true);
                return;
            }
        }
        if (url) navigate(url);
    };

    const onClick = () => {
        setSelectedActivityId(activity.activityId);
        if (activity.isRead === false) updateActivityReadStatus();
        void openItem();
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
