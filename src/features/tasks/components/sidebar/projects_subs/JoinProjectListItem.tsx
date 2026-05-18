import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import LoginIcon from "@mui/icons-material/Login";
import { List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../../i18n";
import { Toggler } from "../common";

type JoinProjectListItemProps = {
    usePM: ProjectManagementState;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
};
export const JoinProjectListItem = (props: JoinProjectListItemProps) => {
    const { usePM, setOpenJoinProject } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

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
                    sx={{
                        overflow: "hidden",
                        borderRadius: "8px",
                        py: 0.75,
                        px: 1.25,
                        ml: 4.5,
                        gap: 1,
                        transition: "all 0.15s ease",
                    }}
                >
                    <LoginIcon />
                    <ListItemContent>
                        <Typography
                            level="body-sm"
                            sx={{
                                fontSize: "14px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%", // take full width of button
                                flex: 1,
                                fontWeight: 500,
                                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
                            }}
                            noWrap
                        >
                            {t.tasks.sidebar.joinProject}
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
                {usePM.teamProjects.map(
                    ({ projectId, projectName, isPrivate, systemUserId, isJoined }, index) => {
                        return (
                            isJoined === false && (
                                <ListItem key={`listitem-team-project-${projectId}-${index}`}>
                                    <ListItemButton
                                        color={"neutral"}
                                        variant={
                                            projectId === usePM.currentProject?.projectId
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
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%", // take full width of button
                                                fontSize: "15px",
                                                ml: "65px",
                                                fontWeight: 500,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.8)"
                                                    : "rgba(0,0,0,0.7)",
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

                {usePM.teamProjects.filter((project) => project.isJoined === false).length ===
                    0 && (
                    <ListItem>
                        <Typography
                            level="body-sm"
                            sx={{
                                fontSize: "15px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%", // take full width of button
                                ml: "50px",
                                flex: 1,
                                fontWeight: 500,
                                color: isDark
                                    ? "rgba(255, 255, 255, 0.45)"
                                    : "rgba(0, 0, 0, 0.41)",
                            }}
                            noWrap
                        >
                            {t.tasks.sidebar.noProjectsAvailable}
                        </Typography>
                    </ListItem>
                )}
            </List>
        </Toggler>
    );
};
