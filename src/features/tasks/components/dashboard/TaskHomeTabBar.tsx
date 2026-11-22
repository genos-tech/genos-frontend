import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import { Box, Button, Stack, TabList, Tabs } from "@mui/joy";
import Tab, { tabClasses } from "@mui/joy/Tab";

import { useTranslation } from "../../../../i18n";
import type { TaskDashboardTab } from "./taskHomeTypes";
import type { TaskHomeData } from "./useTaskHomeData";

type TaskHomeTabBarProps = Pick<
    TaskHomeData,
    | "isDark"
    | "activeTab"
    | "setActiveTab"
    | "myStats"
    | "handleGoToTable"
    | "handleGoToBoard"
    | "handleCreateTask"
>;

export const TaskHomeTabBar = ({
    isDark,
    activeTab,
    setActiveTab,
    myStats,
    handleGoToTable,
    handleGoToBoard,
    handleCreateTask,
}: TaskHomeTabBarProps) => {
    const { t } = useTranslation();
    return (
        <>
            {/* ════════ Section tabs + Quick Actions ════════ */}
            {/* One-screen dashboard: the three insight groups
        are switched via these tabs (they never route). The
        project + sprint selectors stay pinned above because
        the Overall tab's "Closed (Sprint)" column depends on
        the selected sprint. */}
            {/* MIP-1187: the row wraps on md+ so the quick actions move to their own
        line when the tabs (now six) no longer fit beside them; before, the
        tabs scrolled Member's Tasks and Agent Activity out of view at 1440. */}
            <Stack
                alignItems={{ md: "center" }}
                direction={{ xs: "column", md: "row" }}
                flexWrap={{ md: "wrap" }}
                spacing={1.5}
                sx={{ mt: 1, rowGap: 1.5 }}
            >
                <Tabs
                    aria-label={t.tasks.dashboard.sectionsAriaLabel}
                    value={activeTab}
                    sx={{
                        flex: { xs: 1, md: "1 1 auto" },
                        minWidth: 0,
                        width: { xs: "100%", md: "auto" },
                        backgroundColor: "transparent",
                    }}
                    onChange={(_, value) => value && setActiveTab(value as TaskDashboardTab)}
                >
                    <TabList
                        sx={{
                            gap: 0.5,
                            flexWrap: "nowrap",
                            overflowX: "auto",
                            [`&& .${tabClasses.root}`]: {
                                // `0 0 auto`, NOT `initial`. `initial` is
                                // `0 1 auto` — shrink ENABLED — so at a narrow
                                // width the tabs compressed below their content
                                // and, with `whiteSpace: nowrap`, their labels
                                // spilled over each other instead of the
                                // TabList's `overflowX: auto` kicking in.
                                // Refusing to shrink turns that squash back
                                // into a scroll.
                                flex: "0 0 auto",
                                bgcolor: "transparent",
                                borderRadius: "10px 10px 0 0",
                                px: 2,
                                py: 1,
                                gap: 1,
                                fontWeight: 500,
                                fontSize: "0.8rem",
                                whiteSpace: "nowrap",
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    bgcolor: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.03)",
                                    color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
                                },
                                [`&.${tabClasses.selected}`]: {
                                    color: isDark
                                        ? "var(--gp-brandalt-400)"
                                        : "var(--gp-brand-700)",
                                    fontWeight: 600,
                                    bgcolor: isDark
                                        ? "rgba(var(--gp-brandalt-500-rgb), 0.1)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.08)",
                                    "&::after": {
                                        height: "2px",
                                        borderRadius: "2px 2px 0 0",
                                        bgcolor: isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
                                    },
                                },
                            },
                        }}
                    >
                        <Tab value="today" indicatorInset>
                            <TodayRoundedIcon sx={{ fontSize: 16 }} />
                            {t.tasks.dashboard.tabToday}
                        </Tab>
                        <Tab value="overall" indicatorInset>
                            <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
                            {t.tasks.dashboard.tabOverall}
                        </Tab>
                        <Tab value="sprint" indicatorInset>
                            <CalendarMonthRoundedIcon sx={{ fontSize: 16 }} />
                            {t.tasks.dashboard.tabSprint}
                        </Tab>
                        <Tab value="milestones" indicatorInset>
                            <FlagRoundedIcon sx={{ fontSize: 16 }} />
                            {t.tasks.dashboard.tabMilestones}
                        </Tab>
                        <Tab value="mytasks" indicatorInset>
                            <PersonRoundedIcon sx={{ fontSize: 16 }} />
                            {t.tasks.dashboard.tabMyTasks}
                            {myStats.totalCount > 0 && (
                                <Box
                                    component="span"
                                    sx={{
                                        ml: 0.5,
                                        px: 0.8,
                                        py: 0.2,
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        borderRadius: "6px",
                                        background:
                                            activeTab === "mytasks"
                                                ? isDark
                                                    ? "rgba(var(--gp-brandalt-500-rgb), 0.2)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : isDark
                                                  ? "rgba(255,255,255,0.08)"
                                                  : "rgba(0,0,0,0.06)",
                                        color:
                                            activeTab === "mytasks"
                                                ? isDark
                                                    ? "var(--gp-brandalt-400)"
                                                    : "var(--gp-brand-700)"
                                                : isDark
                                                  ? "rgba(255,255,255,0.5)"
                                                  : "rgba(0,0,0,0.5)",
                                    }}
                                >
                                    {myStats.totalCount}
                                </Box>
                            )}
                        </Tab>
                        <Tab value="members" indicatorInset>
                            <GroupsRoundedIcon sx={{ fontSize: 16 }} />
                            {t.tasks.dashboard.tabMemberTasks}
                        </Tab>
                        <Tab value="agent" indicatorInset>
                            <SmartToyRoundedIcon sx={{ fontSize: 16 }} />
                            {t.tasks.dashboard.tabAgentActivity}
                        </Tab>
                    </TabList>
                </Tabs>
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexShrink: 0, width: { xs: "100%", md: "auto" } }}
                >
                    <Button
                        size="sm"
                        startDecorator={<AddRoundedIcon />}
                        variant="soft"
                        sx={{
                            flex: { xs: 1, md: "none" },
                            background: isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.07)",
                            color: "#22c55e",
                            "&:hover": {
                                background: isDark
                                    ? "rgba(34,197,94,0.18)"
                                    : "rgba(34,197,94,0.14)",
                            },
                        }}
                        onClick={handleCreateTask}
                    >
                        {t.tasks.dashboard.newTask}
                    </Button>
                    <Button
                        size="sm"
                        startDecorator={<FolderOpenRoundedIcon />}
                        variant="soft"
                        sx={{
                            flex: { xs: 1, md: "none" },
                            background: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.07)",
                            color: "#3b82f6",
                            "&:hover": {
                                background: isDark
                                    ? "rgba(59,130,246,0.18)"
                                    : "rgba(59,130,246,0.14)",
                            },
                        }}
                        onClick={handleGoToTable}
                    >
                        {t.tasks.sidebar.taskTable}
                    </Button>
                    <Button
                        size="sm"
                        startDecorator={<ViewKanbanRoundedIcon />}
                        variant="soft"
                        sx={{
                            flex: { xs: 1, md: "none" },
                            background: isDark
                                ? "rgba(var(--gp-brand-600-rgb), 0.1)"
                                : "rgba(var(--gp-brand-600-rgb), 0.07)",
                            color: "var(--gp-brand-500)",
                            "&:hover": {
                                background: isDark
                                    ? "rgba(var(--gp-brand-600-rgb), 0.18)"
                                    : "rgba(var(--gp-brand-600-rgb), 0.14)",
                            },
                        }}
                        onClick={handleGoToBoard}
                    >
                        {t.tasks.sidebar.sprintBoard}
                    </Button>
                </Stack>
            </Stack>
        </>
    );
};
