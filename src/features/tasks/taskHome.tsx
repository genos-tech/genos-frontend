import { useState } from "react";
import { Box, CssBaseline } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";

import { TaskHomeLayout } from "./components/layout/TaskHomeLayout";
import { TaskHomeModals } from "./components/modals/TaskHomeModals";
import { TaskHomeProps } from "./types/TaskHomeTypes";

import { Sidebar } from "../../components/layout/sidebar";

export const TaskHome = (props: TaskHomeProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, useIM, useCM, useNM, usePM, useTM } =
        props;

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
        useTM.setIsTaskHomeVisible(false);
    };

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    useCM={useCM}
                    useIM={useIM}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />

                <TaskHomeLayout
                    useCM={useCM}
                    myself={myself}
                    useNM={useNM}
                    usePM={usePM}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    onCloseTaskHome={handleCloseTaskHome}
                    onCreateProject={handleCreateProject}
                    onCreateTag={handleCreateTag}
                    onDeleteProject={handleDeleteProject}
                />

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
                />

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
        </CssVarsProvider>
    );
};
