import { useState } from "react";
import { Box, CssBaseline } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";

import { TaskHomeLayout } from "./components/layout/TaskHomeLayout";
import { TaskHomeModals } from "./components/modals/TaskHomeModals";
import { useTaskSearch } from "./hooks/useTaskSearch";
import { TaskHomeProps } from "./types/TaskHomeTypes";

import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";

export const TaskHome = (props: TaskHomeProps) => {
    const {
        TEM,
        socket,
        myself,
        setMyself,
        setCurrentMainChat,
        UIM,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
        allChats,
        setAllChats,
        funcSetAllChats,
        moveToSpecificChat,
        NM,
        PM,
        TM,
    } = props;

    // Common
    const { accessToken } = useAuth();

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

    // Search functionality
    const searchHook = useTaskSearch({
        myself,
        currentProject: PM.currentProject,
        accessToken: accessToken || "",
    });

    // Event handlers
    const handleSearchChange = (value: any) => {
        if (value !== null) {
            searchHook.handleSearchClose();
            TM.setCurrentPreviewTaskId(value.taskId);
            TM.setIsTaskPreviewVisible(true);
        }
    };

    const handleCreateProject = () => {
        PM.setOpenCreateProject(true);
    };

    const handleCreateTag = () => {
        TM.setOpenCreateTag(true);
    };

    const handleDeleteProject = () => {
        if (PM.currentProject) {
            setOpenDeleteProject({
                flag: true,
                projectId: PM.currentProject.projectId,
                projectName: PM.currentProject.projectName,
            });
        }
    };

    const handleCloseTaskHome = () => {
        TM.setIsTaskHomeVisible(false);
    };

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    currentTeam={TEM.currentTeam}
                    myself={myself}
                    UIM={UIM}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentTeam={TEM.setCurrentTeam}
                    setMyself={setMyself}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                    unReadInboxItemCount={unReadInboxItemCount}
                />

                <TaskHomeLayout
                    UIM={UIM}
                    allChats={allChats}
                    funcSetAllChats={funcSetAllChats}
                    moveToSpecificChat={moveToSpecificChat}
                    myself={myself}
                    NM={NM}
                    PM={PM}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    socket={socket}
                    TEM={TEM}
                    TM={TM}
                    onCloseTaskHome={handleCloseTaskHome}
                    onCreateProject={handleCreateProject}
                    onCreateTag={handleCreateTag}
                    onDeleteProject={handleDeleteProject}
                />

                <TaskHomeModals
                    allChats={allChats}
                    myself={myself}
                    openDeleteProject={openDeleteProject}
                    openJoinProject={openJoinProject}
                    PM={PM}
                    setAllChats={setAllChats}
                    setOpenDeleteProject={setOpenDeleteProject}
                    setOpenJoinProject={setOpenJoinProject}
                    socket={socket}
                    TM={TM}
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
