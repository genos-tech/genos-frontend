import DashboardIcon from "@mui/icons-material/Dashboard";
import { ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

type DashboardListItemProps = {
    setIsDashboardVisible: (value: boolean) => void;
};
export const DashboardListItem = (props: DashboardListItemProps) => {
    const { setIsDashboardVisible } = props;
    return (
        <ListItem>
            <ListItemButton
                onClick={() => {
                    setIsDashboardVisible(true);
                }}
            >
                <DashboardIcon />
                <ListItemContent>
                    <Typography
                        level="title-sm"
                        sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Dashboard
                    </Typography>
                </ListItemContent>
            </ListItemButton>
        </ListItem>
    );
};
