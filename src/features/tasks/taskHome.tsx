import { useState } from "react";
import { Box, CssBaseline } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";

import { TaskHomeHeader } from "./components/header/TaskHomeHeader";
import { TaskHomeLayout } from "./components/layout/TaskHomeLayout";
import { TaskHomeModals } from "./components/modals/TaskHomeModals";
import { useTaskSearch } from "./hooks/useTaskSearch";
import { TaskHomeActions, TaskHomeProps, TaskHomeState } from "./types/TaskHomeTypes";

import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";
import { TaskType, TaskTypesProps } from "../../types/tasks";

const taskTypes: TaskTypesProps = {
    ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
    closed: { id: 2, statuses: ["Closed"], name: "Closed" },
    deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
};
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
    const [isTaskTableVisible, setTaskTableVisible] = useState(true);
    const [currentFilterName, setCurrentFilterName] = useState<string>("");
    const [filterBy, setFilterBy] = useState<number>(1); // 1: status, 2: tag
    const [selectedTagForFiltering, setSelectedTagForFiltering] = useState<string>();
    const [displayTaskType, setDisplayTaskType] = useState<TaskType>(taskTypes.ongoing);
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
                    isTaskHomeVisible={isTaskHomeVisible}
                    isDashboardVisible={isDashboardVisible}
                    isTaskTableVisible={isTaskTableVisible}
                    currentFilterName={currentFilterName}
                    filterBy={filterBy}
                    selectedTagForFiltering={selectedTagForFiltering}
                    displayTaskType={displayTaskType}
                    TEM={TEM}
                    PM={PM}
                    TM={TM}
                    NM={NM}
                    myself={myself}
                    setMyself={setMyself}
                    setCurrentMainChat={setCurrentMainChat}
                    setOpeningService={setOpeningService}
                    openingService={openingService}
                    allChats={allChats}
                    setAllChats={setAllChats}
                    funcSetAllChats={funcSetAllChats}
                    moveToSpecificChat={moveToSpecificChat}
                    socket={socket}
                    setCurrentFilterName={setCurrentFilterName}
                    setFilterBy={setFilterBy}
                    setSelectedTagForFiltering={setSelectedTagForFiltering}
                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                    setIsDashboardVisible={setIsDashboardVisible}
                    setTaskTableVisible={setTaskTableVisible}
                    teamTaskSearchOptions={searchHook.teamTaskSearchOptions}
                    loading={searchHook.loading}
                    openSearch={searchHook.openSearch}
                    setOpenSearch={(open) =>
                        open ? searchHook.handleSearchOpen() : searchHook.handleSearchClose()
                    }
                    onSearchChange={handleSearchChange}
                    onCreateTask={handleCreateTask}
                    onCreateProject={handleCreateProject}
                    onCreateTag={handleCreateTag}
                    onDeleteProject={handleDeleteProject}
                    onCloseTaskHome={handleCloseTaskHome}
                    setDisplayTaskType={setDisplayTaskType}
                />

                <TaskHomeModals
                    myself={myself}
                    PM={PM}
                    TM={TM}
                    allChats={allChats}
                    setAllChats={setAllChats}
                    socket={socket}
                    openJoinProject={openJoinProject}
                    setOpenJoinProject={setOpenJoinProject}
                    openDeleteProject={openDeleteProject}
                    setOpenDeleteProject={setOpenDeleteProject}
                />

                {/* Hover Animation with CSS */}
                <style>
                    {`
                .resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .resize-handle:hover {
                    background-color: lightgray !important;
                    width: 8px !important;
                }
                `}
                </style>
            </Box>
        </CssVarsProvider>
    );
};
