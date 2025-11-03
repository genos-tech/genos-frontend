import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import LoginIcon from "@mui/icons-material/Login";
import { List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
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
                            sx={{
                                fontSize: "15px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%", // take full width of button
                            }}
                            noWrap
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
                                            startDecorator={
                                                isPrivate ? (
                                                    <LockOutlineIcon
                                                        sx={{
                                                            fontSize: "16px",
                                                        }}
                                                    />
                                                ) : undefined
                                            }
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
                                            noWrap
                                        >
                                            {projectName}
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                            )
                        );
                    }
                )}

                {PM.teamProjects.filter((project) => project.isJoined === false).length === 0 && (
                    <ListItem>
                        <Typography
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%",
                                ml: "40px",
                            }}
                            noWrap
                        >
                            No projects to join
                        </Typography>
                    </ListItem>
                )}
            </List>
        </Toggler>
    );
};
