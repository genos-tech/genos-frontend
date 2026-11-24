import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { Button, IconButton, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { PageHeader } from "../../../../components/ui/page/PageHeader";
import { useAuth } from "../../../../context/authState";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { emitRequestError } from "../../../../services/requestErrorNotifier";
import { shortcutText } from "../../../../shortcuts";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { archiveProject, unarchiveProject } from "../../../archive/archiveApi";
import { ArchivedBanner } from "../../../archive/ArchivedBanner";
import { useArchiveState } from "../../../archive/archiveState";
import { canCustomizeTaskFields, isOwnerOfProject } from "../../../archive/projectOwner";
import { ModalCustomizeTaskFields } from "../modals/ModalCustomizeTaskFields";
import { ModalImportTasksCsv } from "../modals/ModalImportTasksCsv";
import { TaskRefreshButton } from "./TaskRefreshButton";
import { TaskSearchBar } from "./TaskSearchBar";

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

    // "Customize task fields" entry for the owner AND editors, as the API allows (MIP-2336). The
    // role comes from the task-field-rules cache (fetched per project by taskHome) — the item
    // simply stays hidden until that fetch resolves for THIS project. Archive stays owner-only.
    const fieldRules = useTM.taskFieldRules;
    const isProjectOwner = isOwnerOfProject(
        fieldRules,
        usePM.currentProject?.projectId,
        myself.userId
    );
    const canCustomizeFields = canCustomizeTaskFields(
        fieldRules,
        usePM.currentProject?.projectId,
        myself.userId
    );
    const [openCustomizeFields, setOpenCustomizeFields] = useState(false);
    const [openImportCsv, setOpenImportCsv] = useState(false);

    // Archive state (MIP-1693). The open project is archived when the archived set lists it.
    const archiveState = useArchiveState();
    const openProjectId = usePM.currentProject?.projectId;
    const archivedRecord =
        openProjectId == null
            ? undefined
            : archiveState.archivedProjects.find((p) => p.projectId === openProjectId);
    const archived = archivedRecord !== undefined;
    const [archiveBusy, setArchiveBusy] = useState(false);

    // Archive the open project, or put an archived one back. The list moves at once; a refusal
    // says so in one line, and the project stays as it was.
    const toggleArchive = async () => {
        const current = usePM.currentProject;
        if (!current || archiveBusy) return;
        setArchiveBusy(true);
        try {
            if (archived) {
                await unarchiveProject(accessToken, myself.teamId, archivedRecord ?? current);
                usePM.setTeamProjects([...usePM.teamProjects, archivedRecord ?? current]);
            } else {
                await archiveProject(accessToken, myself.teamId, current);
                usePM.setTeamProjects(
                    usePM.teamProjects.filter((p) => p.projectId !== current.projectId)
                );
            }
        } catch {
            emitRequestError(
                "serverMessage",
                archived ? t.common.archive.unarchiveFailed : t.common.archive.archiveFailed
            );
        } finally {
            setArchiveBusy(false);
        }
    };

    const currentProjectId = usePM.currentProject?.projectId;
    // A search result opens in the task preview, whichever project it belongs to.
    const openSearchedTask = (taskId: number) => {
        useTM.setCurrentPreviewTaskId(taskId);
        useTM.setIsTaskPreviewVisible(true);
    };

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
            visible: canCustomizeFields,
            onClick: () => setOpenCustomizeFields(true),
        },
        {
            // MIP-1835: not offered on an archived project (the server refuses it too).
            id: "importCsv",
            kind: "import",
            label: t.tasks.importCsv.menuItem,
            icon: <UploadFileRoundedIcon sx={{ fontSize: 18 }} />,
            visible: !archived && currentProjectId != null,
            onClick: () => setOpenImportCsv(true),
        },
        {
            id: "newProject",
            kind: "newProject",
            label: t.tasks.header.newProjectMenuItem,
            icon: <AddIcon sx={{ fontSize: 18 }} />,
            onClick: onCreateProject,
        },
        {
            id: "archiveProject",
            kind: "archive",
            label: archived
                ? t.common.archive.unarchiveMenuProject
                : t.common.archive.archiveMenuProject,
            icon: archived ? (
                <UnarchiveOutlinedIcon sx={{ fontSize: 18 }} />
            ) : (
                <ArchiveOutlinedIcon sx={{ fontSize: 18 }} />
            ),
            visible: isProjectOwner,
            onClick: toggleArchive,
        },
        {
            id: "deleteProject",
            kind: "delete",
            label: t.tasks.header.deleteProjectMenuItem,
            icon: <DeleteIcon sx={{ fontSize: 18 }} />,
            danger: true,
            // An archive is read-only: unarchive first, then delete (MIP-1693).
            disabled: archived,
            hint: archived ? t.common.archive.deleteDisabled : undefined,
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
                                disabled={archived}
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
                <TaskSearchBar
                    accessToken={accessToken}
                    myself={myself}
                    openTask={openSearchedTask}
                    projectId={currentProjectId}
                />
            </PageHeader>
            {archived && (
                <ArchivedBanner
                    busy={archiveBusy}
                    kind="project"
                    onRestore={isProjectOwner ? toggleArchive : undefined}
                />
            )}
            {currentProjectId != null && openImportCsv && (
                <ModalImportTasksCsv
                    projectId={currentProjectId}
                    open
                    onChanged={() => void usePM.refreshProjectTasks(currentProjectId)}
                    onClose={() => setOpenImportCsv(false)}
                />
            )}
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
