import * as React from "react";
import { useState, useEffect } from "react";
import {
    GlobalStyles,
    Box,
    Divider,
    List,
    ListItem,
    ListItemContent,
    Typography,
    Sheet,
    Autocomplete,
    CircularProgress,
} from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DashboardIcon from "@mui/icons-material/Dashboard";

import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse } from "../../../types/chat";
import { ProjectProps } from "../../../types/tasks";

function Toggler({
    defaultExpanded,
    renderToggle,
    children,
}: {
    defaultExpanded: boolean;
    children: React.ReactNode;
    renderToggle: (params: {
        open: boolean;
        setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    }) => React.ReactNode;
}) {
    const [open, setOpen] = React.useState(defaultExpanded);
    return (
        <React.Fragment>
            {renderToggle({ open, setOpen })}
            <Box
                sx={[
                    {
                        display: "grid",
                        transition: "0.2s ease",
                        "& > *": {
                            overflow: "hidden",
                        },
                    },
                    open ? { gridTemplateRows: "1fr" } : { gridTemplateRows: "0fr" },
                ]}
            >
                {children}
            </Box>
        </React.Fragment>
    );
}

type TaskSidebarProps = {
    myself: UserProps;
};

export const NoteSidebar = (props: TaskSidebarProps) => {
    const { myself } = props;
    const { accessToken } = useAuth();

    // // =======================================================================
    // const [openSearch, setOpenSearch] = useState(false);
    // const [teamTaskOptions, setTeamTaskOptions] = useState<SearchTeamTasksResponse[]>([]);
    // const loading = openSearch && teamTaskOptions.length === 0;

    // useEffect(() => {
    //     let active = true;

    //     if (!loading) {
    //         return undefined;
    //     }

    //     (async () => {
    //         const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList({
    //             myself: myself, accessToken: accessToken || ""
    //         });

    //         if (active) {
    //             setTeamTaskOptions([...loadedTeamTasks]);
    //         }
    //     })();

    //     return () => {
    //         active = false;
    //     };
    // }, [loading]);

    // function onChangeHandler(value: any) {
    //     if (value !== null) {
    //         setOpenSearch(false);
    //         setCurrentPreviewTaskId(value.taskId)
    //     }
    // }
    // // =======================================================================

    return (
        <Sheet
            className="TaskSidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.4s, width 0.4s",
                height: "100dvh",
                width: "100%",
                top: 0,
                p: 2,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                borderRight: "1px solid",
                borderColor: "divider",
            }}
        >
            <GlobalStyles
                styles={(theme) => ({
                    ":root": {
                        "--TaskSidebar-width": "220px",
                        [theme.breakpoints.up("lg")]: {
                            "--TaskSidebar-width": "240px",
                        },
                    },
                })}
            />

            {/* ============================================================================ */}

            {/* <Box>
                <Autocomplete
                    placeholder={"Search"}
                    open={openSearch}
                    onOpen={() => {
                        setOpenSearch(true);
                    }}
                    onClose={() => {
                        setOpenSearch(false);
                    }}
                    isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
                    getOptionLabel={(option) => `${option.taskId} | ${option.title}`}
                    options={teamTaskOptions}
                    loading={loading}
                    endDecorator={
                        loading ? (
                            <CircularProgress size="sm" sx={{ bgcolor: 'background.surface' }} />
                        ) : null
                    }
                    slotProps={{
                        listbox: {
                            sx: {
                                zIndex: 10020
                            },
                        },
                    }}
                    onChange={(event, value) => onChangeHandler(value)}
                    size="sm"
                    startDecorator={<SearchRoundedIcon />}
                    aria-label="Search"
                    groupBy={(option) => option.projectName}
                />
            </Box> */}

            {/* ============================================================================ */}

            <Box
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    [`& .${listItemButtonClasses.root}`]: {
                        gap: 1.5,
                    },
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 1,
                        "--List-nestedInsetStart": "30px",
                        "--ListItem-radius": (theme) => theme.vars.radius.sm,
                    }}
                >
                    <ListItem>
                        <ListItemButton onClick={() => {}}>
                            <DashboardIcon />
                            <ListItemContent>
                                <Typography level="title-sm">My Notes</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
