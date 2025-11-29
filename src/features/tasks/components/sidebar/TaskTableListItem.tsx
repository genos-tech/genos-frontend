import TableChartIcon from "@mui/icons-material/TableChart";
import { ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";

type TaskTableListItemProps = {
    useTM: TaskManagementState;
};
export const TaskTableListItem = (props: TaskTableListItemProps) => {
    const { useTM } = props;
    return (
        <ListItem>
            <ListItemButton
                color="primary"
                variant={useTM.isTaskHomeVisible === true ? "soft" : "plain"}
                onClick={() => {
                    useTM.setIsDashboardVisible(false);
                    useTM.setIsTaskHomeVisible(true);
                }}
            >
                <TableChartIcon />
                <ListItemContent>
                    <Typography
                        level="title-sm"
                        sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Task Table
                    </Typography>
                </ListItemContent>
            </ListItemButton>
        </ListItem>
    );
};
