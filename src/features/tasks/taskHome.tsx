import { Box, CssBaseline } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { useState } from "react";

import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";
import { TaskType } from "../../types/tasks";
import { TaskHomeLayout } from "./components/layout/TaskHomeLayout";
import { TaskHomeModals } from "./components/modals/TaskHomeModals";
import { useTaskSearch } from "./hooks/useTaskSearch";
import { TaskHomeProps } from "./types/TaskHomeTypes";
import { taskTypes } from "./types/TaskTableTypes";

export const TaskHome = (props: TaskHomeProps) => {
    const {
        TEM,
        socket,
        myself,
        setMyself,
        setCurrentMainChat,
        openingService,
        setOpeningService,
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
    const [isTaskHomeVisible, setIsTaskHomeVisible] = useState(true);
    const [isDashboardVisible, setIsDashboardVisible] = useState(false);
    const [currentFilterName, setCurrentFilterName] = useState<string>("");
    const [filterBy, setFilterBy] = useState<number>(1); // 1: status, 2: tag
    const [selectedTagForFiltering, setSelectedTagForFiltering] = useState<string>();
    const [displayTaskType, setDisplayTaskType] = useState<TaskType>(taskTypes.all);
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
        displayTaskType,
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

    const handleCreateTask = () => {
        TM.setIsCreatingTask({
            flag: true,
            parentTaskId: null,
            rootTaskId: null,
        });

        if (TM.isTaskPreviewVisible === true) {
            setIsTaskHomeVisible(false);
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
        setIsTaskHomeVisible(false);
    };

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    currentTeam={TEM.currentTeam}
                    myself={myself}
                    openingService={openingService}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentTeam={TEM.setCurrentTeam}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                    unReadInboxItemCount={unReadInboxItemCount}
                />

                <TaskHomeLayout
                    allChats={allChats}
                    displayTaskType={displayTaskType}
                    funcSetAllChats={funcSetAllChats}
                    isDashboardVisible={isDashboardVisible}
                    isTaskHomeVisible={isTaskHomeVisible}
                    loading={searchHook.loading}
                    moveToSpecificChat={moveToSpecificChat}
                    myself={myself}
                    NM={NM}
                    openingService={openingService}
                    openSearch={searchHook.openSearch}
                    PM={PM}
                    setCurrentFilterName={setCurrentFilterName}
                    setCurrentMainChat={setCurrentMainChat}
                    setFilterBy={setFilterBy}
                    setIsDashboardVisible={setIsDashboardVisible}
                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    setSelectedTagForFiltering={setSelectedTagForFiltering}
                    socket={socket}
                    teamTaskSearchOptions={searchHook.teamTaskSearchOptions}
                    TEM={TEM}
                    TM={TM}
                    setOpenSearch={(open) =>
                        open ? searchHook.handleSearchOpen() : searchHook.handleSearchClose()
                    }
                    onCloseTaskHome={handleCloseTaskHome}
                    onCreateProject={handleCreateProject}
                    onCreateTag={handleCreateTag}
                    onCreateTask={handleCreateTask}
                    onDeleteProject={handleDeleteProject}
                    onSearchChange={handleSearchChange}
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
