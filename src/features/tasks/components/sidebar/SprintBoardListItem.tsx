import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import { ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";

type SprintBoardListItemProps = {
    useTM: TaskManagementState;
};

export const SprintBoardListItem = (props: SprintBoardListItemProps) => {
    const { useTM } = props;
    return (
        <ListItem>
            <ListItemButton
                color="primary"
                variant={useTM.isSprintBoardVisible === true ? "soft" : "plain"}
                onClick={() => {
                    useTM.setIsDashboardVisible(false);
                    useTM.setIsTaskHomeVisible(false);
                    useTM.setIsSprintBoardVisible(true);
                }}
            >
                <ViewKanbanIcon />
                <ListItemContent>
                    <Typography
                        level="title-sm"
                        sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Sprint Board
                    </Typography>
                </ListItemContent>
            </ListItemButton>
        </ListItem>
    );
};
