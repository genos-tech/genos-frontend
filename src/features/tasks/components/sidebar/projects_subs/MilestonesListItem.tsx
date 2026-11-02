import { ReactNode, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DirectionsRunRoundedIcon from "@mui/icons-material/DirectionsRunRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import {
    Avatar,
    AvatarGroup,
    Box,
    Chip,
    List,
    ListItem,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { Milestone, MilestoneFolder } from "../../../sprint-milestone/types";
import { groupMilestonesByFolder } from "../../../sprint-milestone/utils/groupMilestonesByFolder";
import {
    getMilestoneStatusChipColor,
    groupMilestonesByYearAndSprint,
    selectSidebarLiveMilestones,
    selectSidebarPastMilestones,
} from "../../../sprint-milestone/utils/sortMilestones";
import { taskMetaLabel } from "../../../utils/taskMeta";
import { FolderMenu, MilestoneRowMenu } from "./MilestoneFolderMenus";
import { MilestoneFolderModalState, ModalMilestoneFolder } from "./ModalMilestoneFolder";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type Props = {
    currentProjectId: number;
    usePM: ProjectManagementState;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
};

export const MilestonesListItem = ({
    currentProjectId,
    usePM,
    useSM,
    useTM,
    useTEM,
    useCM,
    useUISM,
    myself,
    setMyself,
    socket,
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const sprints = useSM.projectSprints[currentProjectId] ?? [];

    const milestones: Milestone[] = useMemo(
        () =>
            selectSidebarLiveMilestones(useSM.projectMilestones[currentProjectId] ?? [], sprints),
        [useSM.projectMilestones, currentProjectId, sprints]
    );

    // "Past milestones": Closed milestones whose sprint has ended, plus Closed
    // milestones that never got a sprint (shown here as "No Sprint"). The
    // ended-sprint ones are hidden from the board/table (and the member
    // filter); this folder is the only way to reach them. Clicking one scopes the table/board to it (same
    // `handleOpen` as a live milestone), which un-hides its full task history.
    const pastMilestones: Milestone[] = useMemo(
        () =>
            selectSidebarPastMilestones(useSM.projectMilestones[currentProjectId] ?? [], sprints),
        [useSM.projectMilestones, currentProjectId, sprints]
    );

    // Same past milestones, bucketed into a year → sprint tree so the folder
    // renders as `<year>/<sprint>/<milestone>` instead of a flat list that
    // could run to hundreds of rows. Display-only — every consumer that filters
    // or scopes still reads the flat `pastMilestones` above.
    const pastMilestonesByYear = useMemo(
        () => groupMilestonesByYearAndSprint(pastMilestones, sprints),
        [pastMilestones, sprints]
    );

    // Folders (MIP-847): load the project's folders when the sidebar shows it,
    // and again whenever its milestones reload, so a folder renamed or filed
    // into elsewhere shows up. Members change folders from other tabs and
    // devices; there is no socket push for them, same as sprint moves.
    const { loadFoldersForProject, tsLastMilestonesLoaded } = useSM;
    useEffect(() => {
        void loadFoldersForProject(currentProjectId);
    }, [loadFoldersForProject, currentProjectId, tsLastMilestonesLoaded]);

    const folders: MilestoneFolder[] = useSM.projectFolders[currentProjectId] ?? [];
    // Plain grouping of the VISIBLE milestones. A Closed milestone whose sprint
    // ended is not in `milestones`, so it appears only under Past milestones
    // (and keeps its folder for if it comes back).
    const { folders: folderGroups, unfiled } = useMemo(
        () => groupMilestonesByFolder(milestones, folders),
        [milestones, folders]
    );
    const [folderModal, setFolderModal] = useState<MilestoneFolderModalState | null>(null);
    // A Closed milestone that never had a sprint buckets under a null sprint
    // (its name would otherwise render as the "—" placeholder).
    const pastSprintLabel = (g: { sprintId: number | null; sprintName: string }) =>
        g.sprintId == null ? t.tasks.sidebar.noSprint : g.sprintName;

    const handleOpen = async (milestoneId: number) => {
        // If the clicked milestone belongs to a different project than the
        // one currently in focus, switch projects first. MilestonePreviewInner
        // resolves the milestone via `useSM.projectMilestones[currentProject.projectId]`
        // (TaskPreview.tsx:913-919), so without the switch it would never find
        // the milestone and would fall back to the "Loading milestone…" branch
        // that auto-closes after 3s.
        const needsProjectSwitch = currentProjectId !== usePM.currentProject?.projectId;
        if (needsProjectSwitch) {
            const target = usePM.teamProjects?.find((p) => p.projectId === currentProjectId);
            if (!target) return;
            // Close the existing preview first: while `isTaskPreviewVisible`
            // is true, useTaskRouting's URL-update effect skips its navigate(),
            // which leaves `targetUrlProjectId.current` stale and lets the
            // enforce-match effect revert the project switch.
            useTM.closeTaskPreview();
            useTM.setTableMilestoneFilter(null);
            useTM.setAllTasks([]);
            await usePM.loadProjectsAndTasks(currentProjectId);
            usePM.setCurrentProject({
                projectId: target.projectId,
                projectName: target.projectName,
                projectTags: target.projectTags || [],
                isPrivate: target.isPrivate,
                systemUserId: target.systemUserId,
            });
        }

        // Open the milestone preview AND scope the task table to this
        // milestone (its backing task as the root + its children).
        // Re-clicking a milestone in the same project toggles the
        // table-scope off again; a cross-project click always scopes-on.
        const isAlreadyScoped =
            !needsProjectSwitch && useTM.tableMilestoneFilterId === milestoneId;
        useTM.setCurrentPreviewKind("milestone");
        useTM.setCurrentPreviewMilestoneId(milestoneId);
        useTM.setIsTaskPreviewVisible(true);
        // Stamped with the milestone's own project, so the scope
        // deactivates itself if the user navigates elsewhere.
        useTM.setTableMilestoneFilter(
            isAlreadyScoped ? null : { milestoneId, projectId: currentProjectId }
        );
    };

    const handleAddMilestone = () => {
        useTM.setIsCreatingTask({
            flag: true,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "milestone",
            milestoneId: null,
        });
        useTM.setIsTaskTableVisible(false);
    };

    // `ml` lets callers indent the row deeper when it's nested inside the
    // Past-milestones year/sprint tree (default 5 = the flat, top-level indent).
    const renderMilestoneRow = (m: Milestone, ml = 5, canFile = true) => {
        const sprintName =
            m.sprintId == null
                ? t.tasks.sidebar.noSprint
                : (sprints.find((s) => s.sprintId === m.sprintId)?.name ??
                  t.tasks.sidebar.sprintFallback);
        return (
            <ListItem
                key={m.milestoneId}
                sx={{ pl: 0, pr: 1 }}
                endAction={
                    // Past milestones keep their folder but are not filed from here:
                    // they sit in the year/sprint tree, not in a folder.
                    canFile ? (
                        <MilestoneRowMenu
                            currentFolderId={m.folderId ?? null}
                            folders={folders}
                            milestoneTitle={m.title}
                            onMoveToFolder={(folderId) =>
                                void useSM.moveMilestoneToFolder(m.milestoneId, folderId)
                            }
                        />
                    ) : undefined
                }
            >
                <ListItemButton
                    // `endAction` is absolutely positioned at the right edge, so
                    // the content has to stop short of it (a 2rem button): else
                    // the progress chip and the assignee avatars sit under it.
                    sx={{ borderRadius: 8, ml, py: 0.5, pr: 0.5, mr: canFile ? 4 : 0 }}
                    selected={
                        useTM.currentPreviewKind === "milestone" &&
                        useTM.currentPreviewMilestoneId === m.milestoneId
                    }
                    onClick={() => handleOpen(m.milestoneId)}
                >
                    <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316", mr: 0.75 }} />
                    <ListItemContent>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={0.5}
                            sx={{ minWidth: 0 }}
                        >
                            <Typography
                                level="body-sm"
                                sx={{
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                }}
                            >
                                {m.title}
                            </Typography>
                            <Chip size="sm" variant="soft">
                                {m.tasksClosed ?? 0}/{m.tasksTotal ?? 0}
                            </Chip>
                        </Stack>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={0.5}
                            sx={{ mt: 0.25, flexWrap: "wrap", rowGap: 0.25 }}
                        >
                            <Chip size="sm" variant="outlined">
                                {sprintName}
                            </Chip>
                            {(() => {
                                const tone = getMilestoneStatusChipColor(m.status);
                                return (
                                    <Chip
                                        size="sm"
                                        variant="solid"
                                        sx={{
                                            backgroundColor: tone.color,
                                            color: tone.textColor,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {taskMetaLabel(m.status, t.tasks.filters)}
                                    </Chip>
                                );
                            })()}
                            <Box sx={{ flex: 1 }} />
                            <AvatarGroup size="sm" sx={{ "--Avatar-size": "18px" }}>
                                {m.assignees.slice(0, 4).map((a) => {
                                    const userIdKey = a.userId != null ? String(a.userId) : "";
                                    const profile = userIdKey
                                        ? useTEM.teamMemberProfiles[userIdKey]
                                        : undefined;
                                    // Use AvatarWithStatus when we can resolve
                                    // the team member profile (gives us online
                                    // pulse + click-to-profile); fall back to a
                                    // plain Avatar for legacy assignees that
                                    // aren't in the team profile map (e.g.
                                    // recently removed members).
                                    return profile ? (
                                        <AvatarWithStatus
                                            key={userIdKey}
                                            avatarSize={18}
                                            avatarUser={profile}
                                            isYou={String(myself.userId) === userIdKey}
                                            myself={myself}
                                            setMyself={setMyself}
                                            showPulseDot={false}
                                            socket={socket}
                                            useCM={useCM}
                                            useUISM={useUISM}
                                        />
                                    ) : (
                                        <Avatar
                                            key={userIdKey || `idx-${a.username}`}
                                            sx={{ fontSize: 10 }}
                                            src={
                                                a.profileImageUrl
                                                    ? `${media_url}/${a.profileImageUrl}`
                                                    : undefined
                                            }
                                        >
                                            {(a.username?.[0] || "?").toUpperCase()}
                                        </Avatar>
                                    );
                                })}
                            </AvatarGroup>
                        </Stack>
                    </ListItemContent>
                </ListItemButton>
            </ListItem>
        );
    };

    return (
        <List sx={{ gap: 0.25 }}>
            {folderGroups.map(({ folder, milestones: inFolder }) => (
                <MilestoneTreeFolder
                    key={`folder-${folder.folderId}`}
                    count={inFolder.length}
                    isDark={isDark}
                    label={folder.name}
                    ml={5}
                    actions={
                        <FolderMenu
                            folderName={folder.name}
                            onDelete={() =>
                                setFolderModal({
                                    mode: "delete",
                                    folderId: folder.folderId,
                                    name: folder.name,
                                })
                            }
                            onRename={() =>
                                setFolderModal({
                                    mode: "rename",
                                    folderId: folder.folderId,
                                    name: folder.name,
                                })
                            }
                        />
                    }
                    icon={
                        <FolderRoundedIcon
                            sx={{
                                fontSize: 15,
                                mr: 0.75,
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                            }}
                        />
                    }
                    defaultOpen
                >
                    {inFolder.map((m) => renderMilestoneRow(m, 7))}
                </MilestoneTreeFolder>
            ))}
            {folderGroups.length > 0 && unfiled.length > 0 && (
                <ListItem sx={{ pl: 0, pb: 0 }}>
                    <Typography
                        level="body-xs"
                        sx={{ ml: 5, pl: 1, opacity: 0.55, textTransform: "uppercase" }}
                    >
                        {t.tasks.folders.unfiled}
                    </Typography>
                </ListItem>
            )}
            {unfiled.map((m) => renderMilestoneRow(m))}
            {pastMilestones.length > 0 && (
                <MilestoneTreeFolder
                    count={pastMilestones.length}
                    isDark={isDark}
                    label={t.tasks.sidebar.pastMilestones}
                    ml={5}
                    icon={
                        <HistoryRoundedIcon
                            sx={{
                                fontSize: 15,
                                mr: 0.75,
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                            }}
                        />
                    }
                >
                    {pastMilestonesByYear.map((yearGroup) => {
                        const yearCount = yearGroup.sprints.reduce(
                            (n, s) => n + s.milestones.length,
                            0
                        );
                        return (
                            <MilestoneTreeFolder
                                key={yearGroup.year}
                                count={yearCount}
                                isDark={isDark}
                                label={yearGroup.year}
                                ml={7}
                                icon={
                                    <CalendarMonthRoundedIcon
                                        sx={{
                                            fontSize: 15,
                                            mr: 0.75,
                                            color: isDark
                                                ? "rgba(255,255,255,0.45)"
                                                : "rgba(0,0,0,0.4)",
                                        }}
                                    />
                                }
                            >
                                {yearGroup.sprints.map((sprintGroup) => (
                                    <MilestoneTreeFolder
                                        key={sprintGroup.sprintId ?? "none"}
                                        count={sprintGroup.milestones.length}
                                        isDark={isDark}
                                        label={pastSprintLabel(sprintGroup)}
                                        ml={9}
                                        icon={
                                            <DirectionsRunRoundedIcon
                                                sx={{
                                                    fontSize: 15,
                                                    mr: 0.75,
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.45)"
                                                        : "rgba(0,0,0,0.4)",
                                                }}
                                            />
                                        }
                                    >
                                        {sprintGroup.milestones.map((m) =>
                                            renderMilestoneRow(m, 11, false)
                                        )}
                                    </MilestoneTreeFolder>
                                ))}
                            </MilestoneTreeFolder>
                        );
                    })}
                </MilestoneTreeFolder>
            )}
            <AddMilestoneRow isDark={isDark} onClick={handleAddMilestone} />
            <AddFolderRow isDark={isDark} onClick={() => setFolderModal({ mode: "create" })} />
            <ModalMilestoneFolder
                state={folderModal}
                onClose={() => setFolderModal(null)}
                onDelete={(folderId) => useSM.removeFolder(folderId, currentProjectId)}
                onCreate={async (name) =>
                    (await useSM.createFolder(currentProjectId, name)) !== null
                }
                onRename={async (folderId, name) =>
                    (await useSM.renameFolder(folderId, currentProjectId, name)) !== null
                }
            />
        </List>
    );
};

// Generic collapsible folder used for every level of the "Past milestones"
// tree (Past milestones → year → sprint). Defaults collapsed — it's an
// archive, not something the user looks at every session. `ml` sets the
// indent so nested levels staircase inward.
const MilestoneTreeFolder = ({
    icon,
    label,
    count,
    ml,
    isDark,
    children,
    defaultOpen = false,
    actions,
}: {
    icon: ReactNode;
    label: string;
    count: number;
    ml: number;
    isDark: boolean;
    children: ReactNode;
    // Folders of live milestones open by default (the work is the point);
    // the Past-milestones archive stays collapsed.
    defaultOpen?: boolean;
    // Row actions (a "..." menu), laid out at the right edge by ListItem.
    actions?: ReactNode;
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <>
            <ListItem endAction={actions} sx={{ pl: 0, pr: actions ? 1 : undefined }}>
                <ListItemButton
                    // Same as the milestone row: stop short of the "..." menu.
                    sx={{ borderRadius: 8, ml, py: 0.5, pr: 0.5, mr: actions ? 4 : 0 }}
                    onClick={() => setOpen((prev) => !prev)}
                >
                    {icon}
                    <ListItemContent>
                        <Typography
                            level="body-sm"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 500,
                                // The same weight and colour as the sidebar's "Projects" and
                                // "Recents" headings, so a folder reads as a peer of those.
                                color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                            }}
                        >
                            {label}
                        </Typography>
                    </ListItemContent>
                    <Chip size="sm" variant="soft">
                        {count}
                    </Chip>
                    <KeyboardArrowDownRoundedIcon
                        sx={{
                            fontSize: 16,
                            ml: 0.5,
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                            transition: "transform 0.2s ease",
                            transform: open ? "rotate(180deg)" : "none",
                        }}
                    />
                </ListItemButton>
            </ListItem>
            {open && children}
        </>
    );
};

const AddMilestoneRow = ({ onClick, isDark }: { onClick: () => void; isDark: boolean }) => {
    const { t } = useTranslation();
    return (
        <ListItem sx={{ pl: 0 }}>
            <ListItemButton sx={{ borderRadius: 8, ml: 5, py: 0.5 }} onClick={onClick}>
                <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography
                    level="body-sm"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                    }}
                >
                    {t.tasks.sidebar.addMilestone}
                </Typography>
            </ListItemButton>
        </ListItem>
    );
};

const AddFolderRow = ({ onClick, isDark }: { onClick: () => void; isDark: boolean }) => {
    const { t } = useTranslation();
    return (
        <ListItem sx={{ pl: 0 }}>
            <ListItemButton sx={{ borderRadius: 8, ml: 5, py: 0.5 }} onClick={onClick}>
                <FolderRoundedIcon
                    sx={{
                        fontSize: 16,
                        mr: 0.5,
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                    }}
                />
                <Typography
                    level="body-sm"
                    sx={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)" }}
                >
                    {t.tasks.folders.newFolder}
                </Typography>
            </ListItemButton>
        </ListItem>
    );
};
