import AddIcon from "@mui/icons-material/Add";
import { ListItem, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";

type NewProjectListItemProps = {
    usePM: ProjectManagementState;
};
export const NewProjectListItem = (props: NewProjectListItemProps) => {
    const { usePM } = props;
    return (
        <ListItem key={"listitem-createProject"}>
            <ListItemButton
                color="primary"
                sx={{
                    overflow: "hidden",
                    borderRadius: "8px",
                    py: 0.75,
                    px: 1.25,
                    ml: 0.5,
                    gap: 1,
                    transition: "all 0.15s ease",
                }} // ensure children don't overflow
                onClick={() => {
                    usePM.setOpenCreateProject(true);
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
