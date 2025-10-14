import AddIcon from "@mui/icons-material/Add";
import { ListItem, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

type NewProjectListItemProps = {
    setOpenCreateProject: (value: boolean) => void;
};
export const NewProjectListItem = (props: NewProjectListItemProps) => {
    const { setOpenCreateProject } = props;
    return (
        <ListItem key={"listitem-createProject"}>
            <ListItemButton
                color="primary"
                sx={{ overflow: "hidden" }} // ensure children don't overflow
                onClick={() => {
                    setOpenCreateProject(true);
                }}
            >
                <AddIcon />
                <Typography
                    sx={{
                        fontSize: "15px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%", // take full width of button
                    }}
                    noWrap
                >
                    New Project
                </Typography>
            </ListItemButton>
        </ListItem>
    );
};
