import TableChartIcon from "@mui/icons-material/TableChart";
import { ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

type TaskTableListItemProps = {
    isTaskHomeVisible: boolean;
    setIsDashboardVisible: (value: boolean) => void;
    setIsTaskHomeVisible: (value: boolean) => void;
};
export const TaskTableListItem = (props: TaskTableListItemProps) => {
    const { isTaskHomeVisible, setIsDashboardVisible, setIsTaskHomeVisible } = props;
    return (
        <ListItem>
            <ListItemButton
                color="primary"
                variant={isTaskHomeVisible === true ? "soft" : "plain"}
                onClick={() => {
                    setIsDashboardVisible(false);
                    setIsTaskHomeVisible(true);
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
