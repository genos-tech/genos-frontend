import TableChartIcon from "@mui/icons-material/TableChart";
import { ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";

type TaskTableListItemProps = {
    TM: TaskManagementState;
};
export const TaskTableListItem = (props: TaskTableListItemProps) => {
    const { TM } = props;
    return (
        <ListItem>
            <ListItemButton
                color="primary"
                variant={TM.isTaskHomeVisible === true ? "soft" : "plain"}
                onClick={() => {
                    TM.setIsDashboardVisible(false);
                    TM.setIsTaskHomeVisible(true);
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
