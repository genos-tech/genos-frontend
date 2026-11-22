import { useMemo } from "react";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";

import { TabStrip, type TabItem } from "../../../../components/ui/feedback/TabStrip";
import { useTranslation } from "../../../../i18n";
import type { TaskDashboardTab } from "./taskHomeTypes";
import type { TaskHomeData } from "./useTaskHomeData";

type TaskHomeTabBarProps = Pick<TaskHomeData, "activeTab" | "setActiveTab" | "myStats">;

/**
 * The dashboard's section tabs on the shared TabStrip (the same one Inbox and the notes use):
 * flat, one accent underline, a real tablist with arrow keys. They never route by themselves;
 * the open tab is kept in the address by `useDashboardTab`. The quick actions that used to sit
 * beside them live in the page header.
 */
export const TaskHomeTabBar = ({ activeTab, setActiveTab, myStats }: TaskHomeTabBarProps) => {
    const { t } = useTranslation();
    const tabs = useMemo<TabItem[]>(
        () => [
            { id: "today", label: t.tasks.dashboard.tabToday, icon: <TodayRoundedIcon /> },
            {
                id: "overall",
                label: t.tasks.dashboard.tabOverall,
                icon: <TrendingUpRoundedIcon />,
            },
            {
                id: "sprint",
                label: t.tasks.dashboard.tabSprint,
                icon: <CalendarMonthRoundedIcon />,
            },
            {
                id: "milestones",
                label: t.tasks.dashboard.tabMilestones,
                icon: <FlagRoundedIcon />,
            },
            {
                id: "mytasks",
                label: t.tasks.dashboard.tabMyTasks,
                icon: <PersonRoundedIcon />,
                count: myStats.totalCount,
            },
            {
                id: "members",
                label: t.tasks.dashboard.tabMemberTasks,
                icon: <GroupsRoundedIcon />,
            },
            {
                id: "agent",
                label: t.tasks.dashboard.tabAgentActivity,
                icon: <SmartToyRoundedIcon />,
            },
        ],
        [t, myStats.totalCount]
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
