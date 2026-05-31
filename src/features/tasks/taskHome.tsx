import { useState } from "react";
import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { TaskHomeLayout } from "./components/layout/TaskHomeLayout";
import { TaskHomeModals } from "./components/modals/TaskHomeModals";
import { useTaskRouting } from "./hooks/useTaskRouting";
import { TaskHomeProps } from "./types/TaskHomeTypes";

import { LayoutStyles } from "../../components/ui/styles/commonStyle";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { MobileTaskHome } from "./MobileTaskHome";

export const TaskHome = (props: TaskHomeProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, useCM, useNM, usePM, useTM, useSM } =
        props;

    // URL-based routing for tasks
    useTaskRouting({ usePM, useTM });

    // Task Related State
    const [openJoinProject, setOpenJoinProject] = useState({
        flag: false,
        projectId: -1,
        projectName: "",
        isPrivate: true,
        systemUserId: "",
    });
    const [openDeleteProject, setOpenDeleteProject] = useState({
        flag: false,
        projectId: -1,
        projectName: "",
    });

    const handleCreateProject = () => {
        usePM.setOpenCreateProject(true);
    };

    const handleCreateTag = () => {
        useTM.setOpenCreateTag(true);
    };

    const handleDeleteProject = () => {
        if (usePM.currentProject) {
            setOpenDeleteProject({
                flag: true,
                projectId: usePM.currentProject.projectId,
                projectName: usePM.currentProject.projectName,
            });
        }
    };

    const handleCloseTaskHome = () => {
        // Clear every view flag so the close button works regardless
        // of which view is showing. Previously this only flipped
        // `isTaskTableVisible`, which left the dashboard / sprint
        // board open if the user was on those — making the close
        // button look broken when clicked from the Home dashboard.
        useTM.setIsTaskTableVisible(false);
        useTM.setIsTaskDashboardVisible(false);
        useTM.setIsSprintBoardVisible(false);
    };

    const { mode } = useColorScheme();
    const ls = mode === "dark" ? LayoutStyles.dark : LayoutStyles.light;
    const isMobile = useIsMobile();

    return (
        <Box sx={LayoutStyles.outerWrapper}>
            <Sheet sx={ls.serviceSurface}>
                <Box sx={ls.decorTopRight} />
                <Box sx={ls.decorBottomLeft} />

                {isMobile ? (
                    <MobileTaskHome
                        myself={myself}
                        setMyself={setMyself}
                        setOpenJoinProject={setOpenJoinProject}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onCloseTaskHome={handleCloseTaskHome}
                    />
                ) : (
                    <TaskHomeLayout
                        myself={myself}
                        setMyself={setMyself}
                        setOpenJoinProject={setOpenJoinProject}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onCloseTaskHome={handleCloseTaskHome}
                        onCreateProject={handleCreateProject}
                        onCreateTag={handleCreateTag}
                        onDeleteProject={handleDeleteProject}
                    />
                )}

                <TaskHomeModals
                    myself={myself}
                    openDeleteProject={openDeleteProject}
                    openJoinProject={openJoinProject}
                    setOpenDeleteProject={setOpenDeleteProject}
                    setOpenJoinProject={setOpenJoinProject}
                    socket={socket}
                    useCM={useCM}
                    usePM={usePM}
                    useSM={useSM}
                    useTM={useTM}
                />
            </Sheet>

            {/* Hover Animation with CSS */}
            <style>
                {`
                .task-resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .task-resize-handle:hover {
                    background-color: grey !important;
                    width: 8px !important;
                }
                `}
            </style>
        </Box>
    );
};
