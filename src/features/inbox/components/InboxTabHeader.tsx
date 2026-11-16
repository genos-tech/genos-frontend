import { useMemo } from "react";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import { Box } from "@mui/joy";
import { useLocation, useNavigate } from "react-router-dom";

import { TabStrip, type TabItem } from "../../../components/ui/feedback/TabStrip";
import { useTranslation } from "../../../i18n";

type InboxTab = "requests" | "activities";

type InboxTabHeaderProps = {
    requestCount?: number;
    /** Unread activities (MIP-1627). Shown plain: a notice is not a decision waiting on you. */
    activityCount?: number;
};

const PATHS: Record<InboxTab, string> = {
    activities: "/workspace/inbox/activities",
    requests: "/workspace/inbox/requests",
};

export const InboxTabHeader = ({ requestCount, activityCount }: InboxTabHeaderProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // Determine active tab from URL
    const activeTab: InboxTab = location.pathname.includes("/activities")
        ? "activities"
        : "requests";

    // Activities first (left): it is the default landing and where the
    // steady stream (notices + the Genos digest) lives; Requests sit on
    // the right with the count pulling attention when needed.
    const tabs = useMemo<TabItem[]>(
        () => [
            {
                id: "activities",
                label: t.inbox.tabs.activities,
                icon: <NotificationsActiveRoundedIcon />,
                count: activityCount,
            },
            {
                id: "requests",
                label: t.inbox.tabs.requests,
                icon: <PendingActionsRoundedIcon />,
                count: requestCount,
                attention: true,
            },
        ],
        [t, requestCount, activityCount]
    );

    return (
        <Box sx={{ px: { xs: 1.5, md: 3 }, pt: { xs: 0.5, md: 1 }, minWidth: 0 }}>
            <TabStrip
                ariaLabel={t.inbox.tabs.ariaLabel}
                tabs={tabs}
                value={activeTab}
                onChange={(id) => navigate(PATHS[id as InboxTab])}
            />
        </Box>
    );
};

export type { InboxTab };
