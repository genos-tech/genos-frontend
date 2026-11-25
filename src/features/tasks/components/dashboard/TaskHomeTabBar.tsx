import { useMemo } from "react";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";

import { TabStrip, type TabItem } from "../../../../components/ui/feedback/TabStrip";
import { useTranslation } from "../../../../i18n";
import type { TaskDashboardTab } from "./taskHomeTypes";
import type { TaskHomeData } from "./useTaskHomeData";

type TaskHomeTabBarProps = Pick<TaskHomeData, "activeTab" | "setActiveTab">;

/**
 * The dashboard's section tabs on the shared TabStrip (the same one Inbox and the notes use):
 * flat, one accent underline, a real tablist with arrow keys. They never route by themselves;
 * the open tab is kept in the address by `useDashboardTab`. The quick actions that used to sit
 * beside them live in the page header.
 */
export const TaskHomeTabBar = ({ activeTab, setActiveTab }: TaskHomeTabBarProps) => {
    const { t } = useTranslation();
    const tabs = useMemo<TabItem[]>(
        () => [
            { id: "today", label: t.tasks.dashboard.tabToday, icon: <TodayRoundedIcon /> },
            {
                id: "project",
                label: t.tasks.dashboard.tabProject,
                icon: <TrendingUpRoundedIcon />,
            },
            {
                id: "milestones",
                label: t.tasks.dashboard.tabMilestones,
                icon: <FlagRoundedIcon />,
            },
            {
                id: "people",
                label: t.tasks.dashboard.tabPeople,
                icon: <GroupsRoundedIcon />,
            },
            {
                id: "agent",
                label: t.tasks.dashboard.tabAgentActivity,
                icon: <SmartToyRoundedIcon />,
            },
            {
                id: "custom",
                label: t.tasks.dashboard.tabCustomDashboards,
                icon: <DashboardCustomizeRoundedIcon />,
            },
        ],
        [t]
    );

    return (
        <TabStrip
            ariaLabel={t.tasks.dashboard.sectionsAriaLabel}
            tabs={tabs}
            value={activeTab}
            onChange={(id) => setActiveTab(id as TaskDashboardTab)}
        />
    );
};
