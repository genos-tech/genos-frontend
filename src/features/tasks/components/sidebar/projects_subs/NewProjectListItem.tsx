import { ListItem, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import AddIcon from "@mui/icons-material/Add";

type NewProjectListItemProps = {
    setOpenCreateProject: (value: boolean) => void;
};
export const NewProjectListItem = (props: NewProjectListItemProps) => {
    const { setOpenCreateProject } = props;
    return (
        <ListItem key={"listitem-createProject"}>
            <ListItemButton
                color="neutral"
                variant="plain"
                onClick={() => {
                    setOpenCreateProject(true);
                }}
                sx={{ overflow: "hidden" }} // ensure children don't overflow
            >
                <Typography
                    noWrap
                    sx={{
                        fontSize: "15px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%", // take full width of button
                    }}
                    startDecorator={<AddIcon />}
                >
                    New Project
                </Typography>
            </ListItemButton>
        </ListItem>
    );
};
