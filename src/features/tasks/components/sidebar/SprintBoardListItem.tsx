import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import { Box, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";

type SprintBoardListItemProps = {
    useTM: TaskManagementState;
};

export const SprintBoardListItem = (props: SprintBoardListItemProps) => {
    const { useTM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isSelected = useTM.isSprintBoardVisible === true;
    const { t } = useTranslation();

    return (
        <ListItem>
            <ListItemButton
                selected={isSelected}
                onClick={() => {
                    useTM.setIsTaskDashboardVisible(false);
                    useTM.setIsTaskTableVisible(false);
                    useTM.setIsSprintBoardVisible(true);
                }}
                sx={{
                    borderRadius: "10px",
                    py: 1,
                    px: 1.5,
                    gap: 1.5,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        backgroundColor: isDark
                            ? "rgba(124,58,237,0.06)"
                            : "rgba(124,58,237,0.04)",
                    },
                    "&.Mui-selected": {
                        backgroundColor: isDark
                            ? "rgba(124,58,237, 0.15)"
                            : "rgba(124,58,237,0.1)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(124,58,237,0.2)"
                                : "rgba(124,58,237,0.15)",
                        },
                    },
                }}
            >
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isDark
                            ? "rgba(124,58,237,0.08)"
                            : "rgba(124,58,237,0.05)",
                        transition: "all 0.2s ease",
                    }}
                >
                    <ViewKanbanIcon
                        sx={{
                            fontSize: 16,
                            color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
                        }}
                    />
                </Box>
                <ListItemContent>
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                        }}
                    >
                        {t.tasks.sidebar.board}
                    </Typography>
                </ListItemContent>
            </ListItemButton>
        </ListItem>
    );
};
