import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Button, IconButton, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { PageHeader } from "../../../../components/ui/page/PageHeader";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { shortcutText } from "../../../../shortcuts";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { loadTeamTaskList } from "../../services/loadTaskSearchList";
import { ModalCustomizeTaskFields } from "../modals/ModalCustomizeTaskFields";
import { TaskSidebarSearchBox } from "../sidebar/SearchBox";
import { TaskRefreshButton } from "./TaskRefreshButton";

interface TaskHeaderProps {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    onCreateProject: () => void;
    onManageTags: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
    useTM: TaskManagementState;
    // Reaches `ModalProjectProfile` (via `ProjectAvatar`) so its
    // add-members flow can emit `members_added_notice` on the legacy
    // namespace. Passing `null` here silently drops every invite
    // notification opened from this header.
    socket: Socket | null;
}

export const TaskHeader = ({
    myself,
    setMyself,
    useCM,
    useUISM,
    useTEM,
    usePM,
    onCreateProject,
    onManageTags,
    onDeleteProject,
    onCloseTaskHome,
    useTM,
    socket,
}: TaskHeaderProps) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    // Owner-only "Customize task fields" entry. Owner-ness comes from the
    // task-field-rules cache (fetched per project by taskHome) — the item
    // simply stays hidden until that fetch resolves for THIS project.
    const fieldRules = useTM.taskFieldRules;
    const isProjectOwner =
        fieldRules != null &&
        usePM.currentProject != null &&
        fieldRules.projectId === usePM.currentProject.projectId &&
        fieldRules.ownerUserId != null &&
        fieldRules.ownerUserId === myself.userId;
    const [openCustomizeFields, setOpenCustomizeFields] = useState(false);

    // =======================================================================
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskSearchOptions] = useState<SearchTeamTasksResponse[]>(
        []
    );
    const loading = openSearch && teamTaskSearchOptions.length === 0;
    const currentProjectId = usePM.currentProject?.projectId;
    // Drop the cached search results whenever the focused project changes so
    // the next open-search reloads scoped to the new project. Without this,
    // `loading` stays false (cache is non-empty) and the user would keep
    // seeing the previous project's tasks.
    useEffect(() => {
        setTeamTaskSearchOptions([]);
    }, [currentProjectId]);
    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            // Pass the current project id (falling back to -1 = "no filter"
            // when no project is selected) so the header search only surfaces
            // tasks from the project the user is looking at. Active work
            // only: no Closed/Deleted tasks, and (via include_all=false) no
            // tasks whose parent task / milestone is already closed.
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                currentProjectId ?? -1,
                "open,wip,blocked,pending",
                -1,
                accessToken,
                false
            );

            if (active) {
                setTeamTaskSearchOptions([...loadedTeamTasks]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading, currentProjectId]);
    // =======================================================================

    // Find the PM chat that mirrors the focused project so its avatar can
    // render in the header. Post v3-migration `chat.chatId` is the Channel
    // UUID (not the numeric project id), so the old `chatId ===
    // String(projectId)` match never hit and the icon disappeared. Match
    // on the project id the adapter carries in `chat.project.projectId`,
    // mirroring the canonical lookup in `HistoryModal` / `notificationRouter`.
    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            usePM.currentProject != null &&
            chat.project?.projectId === usePM.currentProject.projectId
    );

    // The "..." menu: the project's own actions.
    const menuItems: MoreMenuItem[] = [
        {
            // Mirrors the sidebar's "Add milestone" row in `MilestonesListItem` — same
            // payload (`creationKind: "milestone"`, null parent / root / milestone fk)
            // and the same teardown of the task table view.
            id: "newMilestone",
            kind: "newMilestone",
            label: t.tasks.header.newMilestoneMenuItem,
            icon: <FlagRoundedIcon sx={{ fontSize: 18, color: g.warning.text }} />,
            onClick: () => {
                useTM.setIsCreatingTask({
                    flag: true,
                    parentTaskId: null,
                    rootTaskId: null,
                    creationKind: "milestone",
                    milestoneId: null,
                });
                useTM.setIsTaskTableVisible(false);
            },
        },
        {
            id: "manageTags",
            kind: "tags",
            label: t.tasks.header.manageTagsMenuItem,
            icon: <LocalOfferIcon sx={{ fontSize: 18 }} />,
            onClick: onManageTags,
        },
        {
            id: "customizeFields",
            kind: "customizeFields",
            label: t.tasks.header.customizeFieldsMenuItem,
            icon: <TuneRoundedIcon sx={{ fontSize: 18 }} />,
            visible: isProjectOwner,
            onClick: () => setOpenCustomizeFields(true),
        },
        {
            id: "newProject",
            kind: "newProject",
            label: t.tasks.header.newProjectMenuItem,
            icon: <AddIcon sx={{ fontSize: 18 }} />,
            onClick: onCreateProject,
        },
        {
            id: "deleteProject",
            kind: "delete",
            label: t.tasks.header.deleteProjectMenuItem,
            icon: <DeleteIcon sx={{ fontSize: 18 }} />,
            danger: true,
            onClick: onDeleteProject,
        },
    ];

    return (
        <>
            <PageHeader
                data-testid="task-header"
                actions={
                    <>
                        <AppTooltip
                            title={
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontFamily: "inherit",
                                        color: "inherit",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {shortcutText("global.tasksNew")}
                                </Typography>
                            }
                        >
                            <Button
                                size="sm"
                                startDecorator={<AddIcon />}
                                onClick={useTM.handleCreateTask}
                            >
                                {t.tasks.header.taskButton}
                            </Button>
                        </AppTooltip>

                        {/* Reload the task rows, and re-sync the PR column with them (MIP-1409). */}
                        {currentProjectId && (
                            <TaskRefreshButton
                                onRefresh={() => usePM.refreshProjectTasks(currentProjectId)}
                            />
                        )}

                        <MoreMenu
                            iconFontSize={20}
                            items={menuItems}
                            placement="bottom-end"
                            triggerSize={32}
                        />

                        {/* Close Button */}
                        {(useTM.isTaskPreviewVisible === true ||
                            useTM.isCreatingTask.flag === true) && (
                            <AppTooltip title={t.tasks.header.closePanel}>
                                <IconButton
                                    aria-label={t.tasks.header.closePanel}
                                    color="danger"
                                    size="sm"
                                    variant="plain"
                                    onClick={onCloseTaskHome}
                                >
                                    <CancelIcon sx={{ fontSize: 20 }} />
                                </IconButton>
                            </AppTooltip>
                        )}
                    </>
                }
                leading={
                    pmChat ? (
                        <ProjectAvatar
                            avatarSize={32}
                            myself={myself}
                            pmChat={pmChat}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    ) : undefined
                }
                title={
                    <>
                        {usePM.currentProject?.projectName}
                        {usePM.currentProject?.isPrivate === true && (
                            <AppTooltip title={t.tasks.header.privateProject}>
                                <LockOutlineIcon
                                    sx={{
                                        fontSize: 16,
                                        color: g.text.tertiary,
                                        marginInlineStart: 0.75,
                                        verticalAlign: "text-bottom",
                                    }}
                                />
                            </AppTooltip>
                        )}
                    </>
                }
            >
                <TaskSidebarSearchBox
                    accessToken={accessToken}
                    loading={loading}
                    myself={myself}
                    openSearch={openSearch}
                    setOpenSearch={setOpenSearch}
                    setTeamTaskSearchOptions={setTeamTaskSearchOptions}
                    teamTaskSearchOptions={teamTaskSearchOptions}
                    useTM={useTM}
                />
            </PageHeader>
            <ModalCustomizeTaskFields
                myself={myself}
                open={openCustomizeFields}
                usePM={usePM}
                useTEM={useTEM}
                useTM={useTM}
                onClose={() => setOpenCustomizeFields(false)}
            />
        </>
    );
};
