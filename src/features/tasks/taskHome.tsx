import { useState } from "react";
import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { TaskHomeLayout } from "./components/layout/TaskHomeLayout";
import { TaskHomeModals } from "./components/modals/TaskHomeModals";
import { useTaskRouting } from "./hooks/useTaskRouting";
import { MobileTaskHome } from "./MobileTaskHome";
import { TaskHomeProps } from "./types/TaskHomeTypes";

import { LayoutStyles } from "../../components/ui/styles/commonStyle";
import { useIsMobile } from "../../hooks/common/useIsMobile";

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
        useTM.setIsTaskTableVisible(false);
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
                        useCM={useCM}
                        myself={myself}
                        useNM={useNM}
                        usePM={usePM}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useSM={useSM}
                        useUISM={useUISM}
                        onCloseTaskHome={handleCloseTaskHome}
                        setOpenJoinProject={setOpenJoinProject}
                    />
                ) : (
                    <TaskHomeLayout
                        useCM={useCM}
                        myself={myself}
                        useNM={useNM}
                        usePM={usePM}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useSM={useSM}
                        useUISM={useUISM}
                        onCloseTaskHome={handleCloseTaskHome}
                        onCreateProject={handleCreateProject}
                        onCreateTag={handleCreateTag}
                        onDeleteProject={handleDeleteProject}
                        setOpenJoinProject={setOpenJoinProject}
                    />
                )}

                <TaskHomeModals
                    useCM={useCM}
                    myself={myself}
                    openDeleteProject={openDeleteProject}
                    openJoinProject={openJoinProject}
                    usePM={usePM}
                    setOpenDeleteProject={setOpenDeleteProject}
                    setOpenJoinProject={setOpenJoinProject}
                    socket={socket}
                    useTM={useTM}
                    useSM={useSM}
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
