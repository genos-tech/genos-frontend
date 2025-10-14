import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import LoginIcon from "@mui/icons-material/Login";
import { List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { ProjectProps } from "../../../../../types/tasks";
import { Toggler } from "../common";

type JoinProjectListItemProps = {
    PM: ProjectManagementState;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
};
export const JoinProjectListItem = (props: JoinProjectListItemProps) => {
    const { PM, setOpenJoinProject } = props;

    return (
        <Toggler
            key="toggler-OtherProjects"
            defaultExpanded={false}
            renderToggle={({ open, setOpen }) => (
                <ListItemButton
                    color="primary"
                    onClick={() => {
                        setOpen(!open);
                    }}
                >
                    <LoginIcon />
                    <ListItemContent>
                        <Typography
                            noWrap
                            sx={{
                                fontSize: "15px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%", // take full width of button
                            }}
                        >
                            Join Project
                        </Typography>
                    </ListItemContent>
                    <KeyboardArrowDownIcon
                        sx={[
                            open
                                ? {
                                      transform: "rotate(180deg)",
                                  }
                                : {
                                      transform: "none",
                                  },
                        ]}
                    />
                </ListItemButton>
            )}
        >
            <List sx={{ gap: 0.5 }}>
                {PM.teamProjects.map(
                    ({ projectId, projectName, isPrivate, systemUserId, isJoined }, index) => {
                        return (
                            isJoined === false && (
                                <ListItem key={`listitem-team-project-${projectId}-${index}`}>
                                    <ListItemButton
                                        color={"neutral"}
                                        variant={
                                            projectId === PM.currentProject?.projectId
                                                ? "solid"
                                                : "plain"
                                        }
                                        onClick={() => {
                                            setOpenJoinProject({
                                                flag: true,
                                                projectId: projectId,
                                                projectName: projectName,
                                                isPrivate:
                                                    isPrivate !== undefined ? isPrivate : true,
                                                systemUserId: systemUserId || "",
                                            });
                                        }}
                                        sx={{
                                            overflow: "hidden",
                                        }} // ensure children don't overflow
                                    >
                                        <Typography
                                            noWrap
                                            sx={{
                                                color:
                                                    projectId === PM.currentProject?.projectId
                                                        ? "white"
                                                        : "neutral-500",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%", // take full width of button
                                                ml: "35px",
                                            }}
                                            startDecorator={
                                                isPrivate ? (
                                                    <LockOutlineIcon
                                                        sx={{
                                                            fontSize: "16px",
                                                        }}
                                                    />
                                                ) : undefined
                                            }
                                        >
                                            {projectName}
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                            )
                        );
                    }
                )}
            </List>
        </Toggler>
    );
};
