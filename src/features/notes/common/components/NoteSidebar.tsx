import { useEffect, useMemo, useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import MarkChatUnreadRoundedIcon from "@mui/icons-material/MarkChatUnreadRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { Box, Divider, List, ListItem, ListItemContent, Sheet, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, Messages, useTranslation } from "../../../../i18n";
import { AllChatProps } from "../../../../types/chat";
import {
    ChatNoteMetaProps,
    MyNoteFolderTreeNode,
    MyNoteMetaProps,
    MyNoteMetaTreeNode,
    SharedNoteMetaTreeNode,
    TaskNoteMetaProps,
} from "../../../../types/notes";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { ChildNoteCreator } from "../../chat-notes/components/ChildNoteCreator";
import {
    FolderActionHandlers,
    MyNoteFolderTree,
} from "../../my-notes/components/MyNoteFolderTree";
import { ModalDeleteFolder } from "../../my-notes/modals/ModalDeleteFolder";
import { ModalFolderName } from "../../my-notes/modals/ModalFolderName";
import { ModalMoveToFolder } from "../../my-notes/modals/ModalMoveToFolder";
import { useNoteUnread } from "../context/NoteUnreadContext";
import { useNoteTreeState } from "../hooks/useNoteTreeState";
import { ChatNoteMetaTreeNode, TaskNoteMetaTreeNode } from "../types/noteTypes";
import { FavoriteNoteItem } from "./FavoriteNoteItem";
import { FavoriteNoteSection } from "./FavoriteNoteSection";
import { GroupedNoteSection } from "./GroupedNoteSection";
import { NoteTreeRenderer } from "./NoteTreeRenderer";
import { NoteTypeSection } from "./NoteTypeSection";
import { RecentNoteItem } from "./RecentNoteItem";

// Types for grouped task notes (Project → Milestone → Task → Subtask).
// `directNotes` on a milestone are notes attached to the milestone's own
// backing task. `subtasks` flatten any depth ≥ 2 under the immediate
// parent task — strict-3-level UX.
interface SubtaskGroup {
    taskId: number;
    // Human-readable id for the folder label; null when the backend
    // hasn't backfilled `project_task_number` yet — the render falls
    // back to `#<taskId>` via `formatTaskDisplayId`.
    displayId: string | null;
    taskTitle: string;
    notes: TaskNoteMetaTreeNode[];
}

interface TaskGroup {
    taskId: number;
    // Same as SubtaskGroup.displayId — null falls back to `#<taskId>`.
    displayId: string | null;
    taskTitle: string;
    notes: TaskNoteMetaTreeNode[];
    subtasks: SubtaskGroup[];
}

interface MilestoneGroup {
    milestoneId: number;
    milestoneTitle: string;
    directNotes: TaskNoteMetaTreeNode[];
    tasks: TaskGroup[];
}

interface ProjectGroup {
    projectId: number;
    projectName: string;
    milestones: MilestoneGroup[];
    looseTasks: TaskGroup[];
}

interface ChatGroup {
    chatId: number;
    chatType: number;
    chatName: string;
    notes: ChatNoteMetaTreeNode[];
}

interface ChatTypeGroup {
    chatType: number;
    chatTypeName: string;
    chats: ChatGroup[];
}

// Group task notes by Project → Milestone (optional) → Task → Subtask.
// Resolution rules:
//   1. `isMilestone === true` notes attach to the milestone's `directNotes`.
//   2. Notes whose task has a `milestoneId` slot into that MilestoneGroup;
//      otherwise they go into `looseTasks` directly under the project.
//   3. Within (2), `parentTaskId == null` → the note's task is L2; else
//      L2 is the immediate parent and the note's task becomes an L3
//      subtask. This is the strict-3-level collapse: chains deeper than
//      two levels of task nesting flatten under the immediate parent.
function groupTaskNotes(notes: TaskNoteMetaTreeNode[], t: Messages): ProjectGroup[] {
    const projectMap = new Map<number, ProjectGroup>();

    const getProjectGroup = (note: TaskNoteMetaTreeNode): ProjectGroup => {
        let pg = projectMap.get(note.projectId);
        if (!pg) {
            pg = {
                projectId: note.projectId,
                projectName:
                    note.projectName ||
                    fmt(t.notes.defaults.projectFallback, { projectId: note.projectId }),
                milestones: [],
                looseTasks: [],
            };
            projectMap.set(note.projectId, pg);
        }
        return pg;
    };

    const getMilestoneGroup = (
        pg: ProjectGroup,
        milestoneId: number,
        milestoneTitle: string
    ): MilestoneGroup => {
        let mg = pg.milestones.find((m) => m.milestoneId === milestoneId);
        if (!mg) {
            mg = {
                milestoneId,
                milestoneTitle:
                    milestoneTitle || fmt(t.notes.defaults.milestoneFallback, { milestoneId }),
                directNotes: [],
                tasks: [],
            };
            pg.milestones.push(mg);
        }
        return mg;
    };

    const findOrCreateTaskGroup = (
        tasks: TaskGroup[],
        taskId: number,
        taskTitle: string,
        displayId: string | null
    ): TaskGroup => {
        let tg = tasks.find((tt) => tt.taskId === taskId);
        if (!tg) {
            tg = {
                taskId,
                displayId,
                taskTitle: taskTitle || fmt(t.notes.defaults.taskFallback, { taskId }),
                notes: [],
                subtasks: [],
            };
            tasks.push(tg);
        } else if (tg.displayId == null && displayId != null) {
            // First note in the group may have lacked displayId (e.g.
            // an in-flight optimistic write); upgrade as soon as a
            // sibling note carrying displayId joins the same folder.
            tg.displayId = displayId;
        }
        return tg;
    };

    const findOrCreateSubtaskGroup = (
        tg: TaskGroup,
        taskId: number,
        taskTitle: string,
        displayId: string | null
    ): SubtaskGroup => {
        let sg = tg.subtasks.find((s) => s.taskId === taskId);
        if (!sg) {
            sg = {
                taskId,
                displayId,
                taskTitle: taskTitle || fmt(t.notes.defaults.taskFallback, { taskId }),
                notes: [],
            };
            tg.subtasks.push(sg);
        } else if (sg.displayId == null && displayId != null) {
            sg.displayId = displayId;
        }
        return sg;
    };

    for (const note of notes) {
        const pg = getProjectGroup(note);

        // Case 1: the note's task IS a milestone's backing task. The note
        // attaches to the milestone level itself (`directNotes`), not to
        // any task folder.
        if (note.isMilestone === true && note.milestoneId != null) {
            const mg = getMilestoneGroup(pg, note.milestoneId, note.milestoneTitle ?? "");
            mg.directNotes.push(note);
            continue;
        }

        // Choose the bucket of L2 tasks: inside a milestone or "loose"
        // tasks directly under the project.
        let bucketTasks: TaskGroup[];
        if (note.milestoneId != null) {
            const mg = getMilestoneGroup(pg, note.milestoneId, note.milestoneTitle ?? "");
            bucketTasks = mg.tasks;
        } else {
            bucketTasks = pg.looseTasks;
        }

        // L2 cases:
        //   (a) the note's task has no parent task at all, or
        //   (b) the parent IS the milestone's backing task — in which case
        //       the "parent" folder is the milestone folder itself, so the
        //       note's task should sit directly underneath the milestone
        //       (not as L3 inside a duplicate "Task N" folder that points
        //       at the same task the milestone already represents).
        const parentIsMilestoneBacking = note.parentTaskIsMilestone === true;
        if (note.parentTaskId == null || parentIsMilestoneBacking) {
            const tg = findOrCreateTaskGroup(
                bucketTasks,
                note.taskId,
                note.taskTitle ?? "",
                note.displayId ?? null
            );
            tg.notes.push(note);
        } else {
            // L3 subtask — the parent task is L2, the note's task is L3.
            // Strict-3 collapse: if the real task tree is deeper than 2
            // levels, every deeper task still parents under its immediate
            // parent here.
            const tg = findOrCreateTaskGroup(
                bucketTasks,
                note.parentTaskId,
                note.parentTaskTitle ?? "",
                note.parentTaskDisplayId ?? null
            );
            const sg = findOrCreateSubtaskGroup(
                tg,
                note.taskId,
                note.taskTitle ?? "",
                note.displayId ?? null
            );
            sg.notes.push(note);
        }
    }

    return Array.from(projectMap.values());
}

// Auto-expand helpers — return true if the active note (by id) lives
// anywhere in the subtree, so the section opens to reveal it.
const taskGroupContainsNote = (tg: TaskGroup, noteId: number | undefined): boolean => {
    if (noteId == null) return false;
    return (
        tg.notes.some((n) => n.noteId === noteId) ||
        tg.subtasks.some((s) => s.notes.some((n) => n.noteId === noteId))
    );
};
const milestoneGroupContainsNote = (mg: MilestoneGroup, noteId: number | undefined): boolean => {
    if (noteId == null) return false;
    return (
        mg.directNotes.some((n) => n.noteId === noteId) ||
        mg.tasks.some((tg) => taskGroupContainsNote(tg, noteId))
    );
};
const projectGroupContainsNote = (pg: ProjectGroup, noteId: number | undefined): boolean => {
    if (noteId == null) return false;
    return (
        pg.milestones.some((mg) => milestoneGroupContainsNote(mg, noteId)) ||
        pg.looseTasks.some((tg) => taskGroupContainsNote(tg, noteId))
    );
};

// Utility function to group chat notes by chat type, then by chat name
function groupChatNotes(
    notes: ChatNoteMetaTreeNode[],
    allChats: AllChatProps[],
    t: Messages
): ChatTypeGroup[] {
    const chatTypeMap: Map<number, ChatTypeGroup> = new Map();

    for (const note of notes) {
        const chatTypeName = note.chatTypeName || getChatTypeLabel(note.chatType, t);
        const groupKey = note.chatType === 4 ? 1 : note.chatType;

        if (!chatTypeMap.has(groupKey)) {
            chatTypeMap.set(groupKey, {
                chatType: groupKey,
                chatTypeName: getChatTypeLabel(groupKey, t),
                chats: [],
            });
        }
        const chatTypeGroup = chatTypeMap.get(groupKey)!;

        let chatGroup = chatTypeGroup.chats.find(
            (c) => c.chatType === note.chatType && c.chatId === note.chatId
        );
        if (!chatGroup) {
            // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is
            // `string` post-flip; `note.chatId` is still `number` (legacy
            // note schema). Stringify at the comparison.
            const resolvedName =
                note.chatName ||
                allChats.find(
                    (c) => c.chatType === note.chatType && c.chatId === String(note.chatId)
                )?.chatName ||
                `${chatTypeName} ${note.chatId}`;
            chatGroup = {
                chatId: note.chatId,
                chatType: note.chatType,
                chatName: resolvedName,
                notes: [],
            };
            chatTypeGroup.chats.push(chatGroup);
        }

        chatGroup.notes.push(note);
    }

    return Array.from(chatTypeMap.values());
}

function getChatTypeLabel(chatType: number, t: Messages): string {
    switch (chatType) {
        case 1:
        case 4:
            return t.notes.chatTypes.dm;
        case 2:
            return t.notes.chatTypes.gm;
        case 3:
            return t.notes.chatTypes.pm;
        default:
            return t.notes.chatTypes.chat;
    }
}

type NoteSidebarProps = {
    useNM: NoteManagementState;
    allChats?: AllChatProps[];
};

export const NoteSidebar = (props: NoteSidebarProps) => {
    const { useNM, allChats = [] } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    // Unread @mention state (from the activity feed). Drives the "Unread"
    // section here and the per-note dots inside the tree/recents/favorites.
    const { unreadNotes } = useNoteUnread();

    // Resolve a note's full metadata (for the subtitle: e.g. "DM" on chat
    // notes, project/task on task notes) from the loaded meta lists. Falls
    // back to a title-only stub when the note isn't in the loaded set.
    const findNoteMeta = (
        noteType: number,
        noteId: number
    ): MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps => {
        const found =
            noteType === 2
                ? useNM.taskNoteMeta.find((n) => n.noteId === noteId)
                : noteType === 3
                  ? useNM.chatNoteMeta.find((n) => n.noteId === noteId)
                  : useNM.myNoteMeta.find((n) => n.noteId === noteId);
        return found ?? ({ noteId } as MyNoteMetaProps);
    };

    // "Unread" section content: notes with unread @mentions, rendered with
    // the SAME row as Recents (icon + title + sub-label + unread dot).
    // RecentNoteItem opens the note (loadNote) and marks it read on click,
    // which clears it from this list.
    const renderUnreadNotes = () => (
        <Box>
            {unreadNotes.map((n) => {
                const found = findNoteMeta(n.noteType, n.noteId);
                // Fall back to the activity's title without mutating the
                // shared meta object from the loaded lists.
                const meta = found.title ? found : { ...found, title: n.title };
                return (
                    <RecentNoteItem
                        key={`unread-${n.noteType}-${n.noteId}`}
                        note={meta}
                        noteType={n.noteType}
                        useNM={useNM}
                    />
                );
            })}
        </Box>
    );

    // Load favorite notes on mount
    useEffect(() => {
        useNM.getFavoriteNotesMeta();
    }, []);

    // Load recent notes on mount (parity with favorites — both seed
    // their sidebar sections from the server when this component first
    // appears).
    useEffect(() => {
        useNM.getRecentNotesMeta();
    }, []);

    // Load personal notes shared with me — drives the noteType=4 bucket.
    useEffect(() => {
        useNM.getSharedNoteMeta();
    }, []);

    // Use custom hooks for each note type
    const myNoteState = useNoteTreeState({
        metaTree: useNM.myNoteMetaTree,
        currentChain: useNM.currentMyNoteChain,
        selectedTabIndex: useNM.selectedTabIndex,
        currentNote: useNM.currentMyNote,
    });

    const taskNoteState = useNoteTreeState({
        metaTree: useNM.taskNoteMetaTree,
        currentChain: useNM.currentTaskNoteChain,
        selectedTabIndex: useNM.selectedTabIndex,
        currentNote: useNM.currentTaskNote,
    });

    const chatNoteState = useNoteTreeState({
        metaTree: useNM.chatNoteMetaTree,
        currentChain: useNM.currentChatNoteChain,
        selectedTabIndex: useNM.selectedTabIndex,
        currentNote: useNM.currentChatNote,
    });

    // Shared-with-me personal notes. They are backed by the same
    // personal-note endpoint, so we point the tree's currentNote at
    // `currentMyNote` to drive the row highlight.
    const sharedNoteState = useNoteTreeState<SharedNoteMetaTreeNode>({
        metaTree: useNM.sharedNoteMetaTree,
        currentChain: undefined,
        selectedTabIndex: useNM.selectedTabIndex,
        currentNote: useNM.currentMyNote,
    });

    // ------------------------------------------------------------------
    // My-note folders — modal host. One instance of each dialog serves
    // every folder row / note row; rows only set this state.
    // ------------------------------------------------------------------
    const [folderNameModal, setFolderNameModal] = useState<
        | { mode: "create"; parentFolderId: number | null }
        | { mode: "rename"; folder: MyNoteFolderTreeNode }
        | null
    >(null);
    const [moveModal, setMoveModal] = useState<
        | { kind: "note"; noteId: number; currentFolderId: number | null; isChild: boolean }
        | { kind: "folder"; folder: MyNoteFolderTreeNode }
        | null
    >(null);
    const [deleteFolderModal, setDeleteFolderModal] = useState<MyNoteFolderTreeNode | null>(null);

    const folderActions: FolderActionHandlers = {
        onCreateNoteHere: (folderId) => {
            void useNM.handleCreateNewMyNote(null, folderId);
        },
        onCreateSubfolder: (folderId) =>
            setFolderNameModal({ mode: "create", parentFolderId: folderId }),
        onRenameFolder: (folder) => setFolderNameModal({ mode: "rename", folder }),
        onMoveFolder: (folder) => setMoveModal({ kind: "folder", folder }),
        onDeleteFolder: (folder) => setDeleteFolderModal(folder),
    };

    // Render functions for each note type
    const renderMyNoteTree = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={myNoteState.tmpCurrentChain}
            node={node}
            noteType={1}
            timestamp={myNoteState.timestamp}
            useNM={useNM}
            createChildNoteList={(node) => (
                <ChildNoteCreator node={node} timestamp={myNoteState.timestamp} useNM={useNM} />
            )}
            rowMenuItems={(node: MyNoteMetaTreeNode) => [
                {
                    id: "move-to-folder",
                    label: t.notes.folders.moveToFolder,
                    icon: <DriveFileMoveRoundedIcon sx={{ fontSize: 16 }} />,
                    onClick: () =>
                        setMoveModal({
                            kind: "note",
                            noteId: node.noteId,
                            currentFolderId: node.folderId ?? null,
                            isChild: node.parentNoteId != null,
                        }),
                },
            ]}
        />
    );

    // My Notes section: user folders (nested) + unfiled root notes,
    // headed by a subtle "New folder" affordance. Task/chat sections
    // keep their derived (task/chat-anchored) grouping.
    const renderMyNotesSection = () => (
        <>
            <ListItem>
                <ListItemButton
                    sx={{
                        borderRadius: "8px",
                        py: 0.5,
                        px: 1,
                        my: 0.25,
                        gap: 0.75,
                        minHeight: 30,
                        border: "1px dashed",
                        borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                        "&:hover": {
                            borderColor: isDark ? "rgba(167,139,250,0.6)" : "rgba(124,58,237,0.5)",
                            color: isDark ? "#a78bfa" : "#7c3aed",
                        },
                    }}
                    onClick={() => setFolderNameModal({ mode: "create", parentFolderId: null })}
                >
                    <CreateNewFolderRoundedIcon sx={{ fontSize: 15 }} />
                    <Typography level="body-xs" sx={{ fontWeight: 500, color: "inherit" }}>
                        {t.notes.folders.newFolder}
                    </Typography>
                </ListItemButton>
            </ListItem>
            {useNM.myNoteFolderForest.rootFolders.map((folder) => (
                <MyNoteFolderTree
                    key={`folder-${folder.folderId}`}
                    actions={folderActions}
                    folder={folder}
                    renderNote={renderMyNoteTree}
                    useNM={useNM}
                />
            ))}
            {useNM.myNoteFolderForest.rootNotes.map((root) => renderMyNoteTree(root))}
        </>
    );

    const renderTaskNoteTreeItem = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={taskNoteState.tmpCurrentChain}
            node={node}
            noteType={2}
            timestamp={taskNoteState.timestamp}
            useNM={useNM}
            createChildNoteList={(node) => (
                <ChildNoteCreator node={node} timestamp={taskNoteState.timestamp} useNM={useNM} />
            )}
        />
    );

    const renderChatNoteTreeItem = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={chatNoteState.tmpCurrentChain}
            node={node}
            noteType={3}
            timestamp={chatNoteState.timestamp}
            useNM={useNM}
            createChildNoteList={(node) => (
                <ChildNoteCreator node={node} timestamp={chatNoteState.timestamp} useNM={useNM} />
            )}
        />
    );

    // Shared notes render as personal notes (same hierarchy), but pass
    // noteType={4} so the sidebar highlight and currentNoteType track
    // the "Shared Notes" bucket.
    const renderSharedNoteTreeItem = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={sharedNoteState.tmpCurrentChain}
            node={node}
            noteType={4}
            timestamp={sharedNoteState.timestamp}
            useNM={useNM}
            createChildNoteList={(node) => (
                <ChildNoteCreator
                    node={node}
                    timestamp={sharedNoteState.timestamp}
                    useNM={useNM}
                />
            )}
        />
    );

    // Grouped task notes by project and task
    const groupedTaskNotes = useMemo(
        () => groupTaskNotes(taskNoteState.tmpMetaTree as TaskNoteMetaTreeNode[], t),
        [taskNoteState.tmpMetaTree, t]
    );

    // Grouped chat notes by chat type and name
    const groupedChatNotes = useMemo(
        () => groupChatNotes(chatNoteState.tmpMetaTree as ChatNoteMetaTreeNode[], allChats, t),
        [chatNoteState.tmpMetaTree, allChats, t]
    );

    // Grouped shared notes by the sharer (ownerName)
    const groupedSharedNotes = useMemo(() => {
        const map = new Map<
            string,
            { ownerId: string; ownerName: string; notes: SharedNoteMetaTreeNode[] }
        >();
        (sharedNoteState.tmpMetaTree as SharedNoteMetaTreeNode[]).forEach((note) => {
            const key = String(note.ownerId);
            if (!map.has(key)) {
                map.set(key, {
                    ownerId: note.ownerId,
                    ownerName: note.ownerName || t.notes.sidebar.unknownOwner,
                    notes: [],
                });
            }
            map.get(key)!.notes.push(note);
        });
        return Array.from(map.values());
    }, [sharedNoteState.tmpMetaTree]);

    // Render grouped task notes
    // (Project → Milestone (optional) → Task → Subtask → Notes).
    // Milestones and "loose" tasks (no milestone) coexist at L1 under
    // the project. Subtasks (L3) collapse under the immediate parent
    // task — see `groupTaskNotes` for the resolution rules.
    const renderTaskGroup = (
        taskGroup: TaskGroup,
        keyPrefix: string,
        activeNoteId: number | undefined
    ) => (
        <GroupedNoteSection
            key={`${keyPrefix}-task-${taskGroup.taskId}`}
            defaultExpanded={taskGroupContainsNote(taskGroup, activeNoteId)}
            groupKey={`${keyPrefix}-task-${taskGroup.taskId}`}
            subLabel={taskGroup.taskTitle}
            groupLabel={formatTaskDisplayId({
                taskId: taskGroup.taskId,
                displayId: taskGroup.displayId,
            })}
        >
            {taskGroup.notes.map((note) => renderTaskNoteTreeItem(note))}
            {taskGroup.subtasks.map((subGroup) => (
                <GroupedNoteSection
                    key={`${keyPrefix}-task-${taskGroup.taskId}-sub-${subGroup.taskId}`}
                    defaultExpanded={subGroup.notes.some((n) => n.noteId === activeNoteId)}
                    groupKey={`${keyPrefix}-task-${taskGroup.taskId}-sub-${subGroup.taskId}`}
                    subLabel={subGroup.taskTitle}
                    groupLabel={formatTaskDisplayId({
                        taskId: subGroup.taskId,
                        displayId: subGroup.displayId,
                    })}
                >
                    {subGroup.notes.map((note) => renderTaskNoteTreeItem(note))}
                </GroupedNoteSection>
            ))}
        </GroupedNoteSection>
    );

    const renderGroupedTaskNotes = () =>
        groupedTaskNotes.map((projectGroup) => {
            const activeNoteId = useNM.currentTaskNote?.noteId;
            const projectKey = `project-${projectGroup.projectId}`;
            return (
                <GroupedNoteSection
                    key={projectKey}
                    defaultExpanded={projectGroupContainsNote(projectGroup, activeNoteId)}
                    groupKey={projectKey}
                    groupLabel={projectGroup.projectName}
                >
                    {projectGroup.milestones.map((milestoneGroup) => {
                        const milestoneKey = `${projectKey}-milestone-${milestoneGroup.milestoneId}`;
                        return (
                            <GroupedNoteSection
                                key={milestoneKey}
                                groupKey={milestoneKey}
                                groupLabel={`🚩 ${milestoneGroup.milestoneTitle}`}
                                subLabel={t.notes.sidebar.milestoneLabel}
                                defaultExpanded={milestoneGroupContainsNote(
                                    milestoneGroup,
                                    activeNoteId
                                )}
                            >
                                {milestoneGroup.directNotes.map((note) =>
                                    renderTaskNoteTreeItem(note)
                                )}
                                {milestoneGroup.tasks.map((taskGroup) =>
                                    renderTaskGroup(taskGroup, milestoneKey, activeNoteId)
                                )}
                            </GroupedNoteSection>
                        );
                    })}
                    {projectGroup.looseTasks.map((taskGroup) =>
                        renderTaskGroup(taskGroup, projectKey, activeNoteId)
                    )}
                </GroupedNoteSection>
            );
        });

    // Render grouped shared notes (Sharer → Notes)
    const renderGroupedSharedNotes = () =>
        groupedSharedNotes.map((sharer) => (
            <GroupedNoteSection
                key={`sharer-${sharer.ownerId}`}
                groupKey={`sharer-${sharer.ownerId}`}
                groupLabel={sharer.ownerName}
                defaultExpanded={sharer.notes.some(
                    (note) => note.noteId === useNM.currentMyNote?.noteId
                )}
            >
                {sharer.notes.map((note) => renderSharedNoteTreeItem(note))}
            </GroupedNoteSection>
        ));

    // Render grouped chat notes (Chat Type → Chat Name → Notes)
    const renderGroupedChatNotes = () =>
        groupedChatNotes.map((chatTypeGroup) => (
            <GroupedNoteSection
                key={`chatType-${chatTypeGroup.chatType}`}
                groupKey={`chatType-${chatTypeGroup.chatType}`}
                groupLabel={chatTypeGroup.chatTypeName}
                defaultExpanded={chatTypeGroup.chats.some((chatGroup) =>
                    chatGroup.notes.some((note) => note.noteId === useNM.currentChatNote?.noteId)
                )}
            >
                {chatTypeGroup.chats.map((chatGroup) => (
                    <GroupedNoteSection
                        key={`chat-${chatGroup.chatType}-${chatGroup.chatId}`}
                        groupKey={`chat-${chatGroup.chatType}-${chatGroup.chatId}`}
                        groupLabel={chatGroup.chatName}
                        defaultExpanded={chatGroup.notes.some(
                            (note) => note.noteId === useNM.currentChatNote?.noteId
                        )}
                    >
                        {chatGroup.notes.map((note) => renderChatNoteTreeItem(note))}
                    </GroupedNoteSection>
                ))}
            </GroupedNoteSection>
        ));

    // Render favorite note item
    const renderFavoriteNoteItem = (
        note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps,
        noteType: number
    ) => (
        <FavoriteNoteItem
            key={`fav-${noteType}-${note.noteId}`}
            note={note}
            noteType={noteType}
            useNM={useNM}
        />
    );

    // Render favorite notes section content
    const renderFavoriteNotes = () => {
        if (!useNM.favoriteNotes) return null;

        const hasPersonalNotes = useNM.favoriteNotes.personalNotes.length > 0;
        const hasTaskNotes = useNM.favoriteNotes.taskNotes.length > 0;
        const hasChatNotes = useNM.favoriteNotes.chatNotes.length > 0;

        if (!hasPersonalNotes && !hasTaskNotes && !hasChatNotes) {
            return (
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            fontStyle: "italic",
                        }}
                    >
                        {t.notes.sidebar.noFavorites}
                    </Typography>
                </Box>
            );
        }

        return (
            <Box>
                {hasPersonalNotes && (
                    <FavoriteNoteSection
                        defaultExpanded={true}
                        groupKey="fav-personal"
                        groupLabel={t.notes.sidebar.myNotes}
                        icon={<WindowRoundedIcon sx={{ fontSize: 14 }} />}
                    >
                        {useNM.favoriteNotes.personalNotes.map((note) =>
                            renderFavoriteNoteItem(note, 1)
                        )}
                    </FavoriteNoteSection>
                )}
                {hasTaskNotes && (
                    <FavoriteNoteSection
                        defaultExpanded={true}
                        groupKey="fav-task"
                        groupLabel={t.notes.sidebar.taskNotes}
                        icon={<AssignmentRoundedIcon sx={{ fontSize: 14 }} />}
                    >
                        {useNM.favoriteNotes.taskNotes.map((note) =>
                            renderFavoriteNoteItem(note, 2)
                        )}
                    </FavoriteNoteSection>
                )}
                {hasChatNotes && (
                    <FavoriteNoteSection
                        defaultExpanded={true}
                        groupKey="fav-chat"
                        groupLabel={t.notes.sidebar.chatNotes}
                        icon={<QuestionAnswerRoundedIcon sx={{ fontSize: 14 }} />}
                    >
                        {useNM.favoriteNotes.chatNotes.map((note) =>
                            renderFavoriteNoteItem(note, 3)
                        )}
                    </FavoriteNoteSection>
                )}
            </Box>
        );
    };

    // Pre-compute the recent-notes rows once per `useNM.recentNotes` change.
    // The previous implementation rebuilt the merged + sorted array inside
    // `renderRecentNotes` on every render — three spread map copies plus an
    // O(N log N) sort — even when no recents had moved.
    type RecentRow = {
        note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;
        noteType: number;
        tsOpenedAt: string;
    };
    const sortedRecentRows = useMemo<RecentRow[]>(() => {
        const recents = useNM.recentNotes;
        if (!recents) return [];
        const rows: RecentRow[] = [
            ...recents.personalNotes.map((n) => ({
                note: n,
                noteType: 1,
                tsOpenedAt: n.tsOpenedAt,
            })),
            ...recents.taskNotes.map((n) => ({
                note: n,
                noteType: 2,
                tsOpenedAt: n.tsOpenedAt,
            })),
            ...recents.chatNotes.map((n) => ({
                note: n,
                noteType: 3,
                tsOpenedAt: n.tsOpenedAt,
            })),
        ];
        rows.sort((a, b) => {
            const aT = a.tsOpenedAt ? new Date(a.tsOpenedAt).getTime() : 0;
            const bT = b.tsOpenedAt ? new Date(b.tsOpenedAt).getTime() : 0;
            return bT - aT;
        });
        return rows;
    }, [useNM.recentNotes]);

    // Render recent notes section content. Flat list ordered by
    // tsOpenedAt desc — the natural shape for "recents" since
    // chronology is the primary signal. Each row carries a small
    // type icon so personal/task/chat notes are still distinguishable.
    const renderRecentNotes = () => {
        if (!useNM.recentNotes) return null;

        const rows = sortedRecentRows;

        if (rows.length === 0) {
            return (
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            fontStyle: "italic",
                        }}
                    >
                        {t.notes.sidebar.noRecents}
                    </Typography>
                </Box>
            );
        }

        return (
            <Box>
                {rows.map((row) => (
                    <RecentNoteItem
                        key={`recent-${row.noteType}-${row.note.noteId}`}
                        note={row.note}
                        noteType={row.noteType}
                        useNM={useNM}
                    />
                ))}
            </Box>
        );
    };

    // Note type configurations for cleaner code
    const noteTypesConfig = [
        {
            noteType: 1,
            icon: <WindowRoundedIcon sx={{ fontSize: 18 }} />,
            title: t.notes.sidebar.myNotes,
            state: myNoteState,
            renderTree: null,
            // Folder forest + unfiled roots (was a bare recursive tree).
            renderGrouped: renderMyNotesSection,
            isGrouped: true,
        },
        {
            noteType: 2,
            icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
            title: t.notes.sidebar.taskNotes,
            state: taskNoteState,
            renderTree: null,
            renderGrouped: renderGroupedTaskNotes,
            isGrouped: true,
        },
        {
            noteType: 3,
            icon: <QuestionAnswerRoundedIcon sx={{ fontSize: 18 }} />,
            title: t.notes.sidebar.chatNotes,
            state: chatNoteState,
            renderTree: null,
            renderGrouped: renderGroupedChatNotes,
            isGrouped: true,
        },
        {
            noteType: 4,
            icon: <ShareRoundedIcon sx={{ fontSize: 18 }} />,
            title: t.notes.sidebar.sharedNotes,
            state: sharedNoteState,
            renderTree: null,
            renderGrouped: renderGroupedSharedNotes,
            isGrouped: true,
        },
    ];

    return (
        <Sheet
            className="NoteSidebar"
            sx={{
                // On mobile the sidebar renders inline inside
                // MobileNoteHome, not as a slide-in overlay — so the
                // translate transform and fixed positioning are
                // desktop-only.
                position: { xs: "relative", md: "sticky" },
                transform: {
                    xs: "none",
                    md: "none",
                },
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                // Mobile: fill the MobileNoteHome container (already
                // clamped to viewport - tab bar by LayoutStyles.outerWrapper).
                // Desktop: viewport height since the sticky Sheet has no
                // explicit parent height.
                height: { xs: "100%", md: "100dvh" },
                width: "100%",
                top: 0,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
            }}
        >
            {/* Content */}
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    px: 1.5,
                    py: 1.5,
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 0.5,
                        "--List-nestedInsetStart": "24px",
                        "--ListItem-radius": "8px",
                    }}
                >
                    {/* Home Item */}
                    <ListItem>
                        <ListItemButton
                            selected={useNM.currentNoteType === 0}
                            sx={{
                                borderRadius: "10px",
                                py: 1,
                                px: 1.5,
                                gap: 1.5,
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                "&:hover": {
                                    backgroundColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                },
                                "&.Mui-selected": {
                                    backgroundColor: isDark
                                        ? "rgba(124,58,237,0.15)"
                                        : "rgba(124,58,237,0.1)",
                                    "&:hover": {
                                        backgroundColor: isDark
                                            ? "rgba(124,58,237,0.2)"
                                            : "rgba(124,58,237,0.15)",
                                    },
                                },
                            }}
                            onClick={() => {
                                useNM.setCurrentNoteType(0);
                                localStorage.setItem("lastOpenNoteType", "0");
                            }}
                        >
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.05)",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <HomeRoundedIcon
                                    sx={{
                                        fontSize: 16,
                                        color: isDark
                                            ? "rgba(255,255,255,0.75)"
                                            : "rgba(0,0,0,0.65)",
                                    }}
                                />
                            </Box>
                            <ListItemContent>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(0,0,0,0.8)",
                                    }}
                                >
                                    {t.notes.sidebar.home}
                                </Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>

                    {/* Favorites Section */}
                    <NoteTypeSection
                        icon={<StarRoundedIcon sx={{ fontSize: 18 }} />}
                        noteType={5} // Use 5 for favorites (distinct from 0-4)
                        title={t.notes.sidebar.favorites}
                        useNM={useNM}
                    >
                        {renderFavoriteNotes()}
                    </NoteTypeSection>

                    {/* Recents Section */}
                    <NoteTypeSection
                        icon={<HistoryRoundedIcon sx={{ fontSize: 18 }} />}
                        noteType={6} // Use 6 for recents (distinct from 0-5)
                        title={t.notes.sidebar.recents}
                        useNM={useNM}
                    >
                        {renderRecentNotes()}
                    </NoteTypeSection>

                    {/* Unread Section — bottom of the pinned sections (after
                        Recents), only shown when there are unread @mentions. */}
                    {unreadNotes.length > 0 && (
                        <NoteTypeSection
                            icon={<MarkChatUnreadRoundedIcon sx={{ fontSize: 18 }} />}
                            noteType={7} // 7 = unread (distinct from 0-6)
                            title={fmt(t.notes.sidebar.unread, { count: unreadNotes.length })}
                            useNM={useNM}
                        >
                            {renderUnreadNotes()}
                        </NoteTypeSection>
                    )}

                    {/* Section Divider */}
                    <Box sx={{ pt: 1.5, pb: 0.5, px: 1 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                fontSize: 10,
                                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            }}
                        >
                            {t.notes.sidebar.workspaces}
                        </Typography>
                    </Box>

                    {/* Note Type Sections */}
                    {noteTypesConfig.map((config) => (
                        <NoteTypeSection
                            key={config.noteType}
                            icon={config.icon}
                            noteType={config.noteType}
                            title={config.title}
                            useNM={useNM}
                        >
                            {/* Every section renders through its grouped
                                function now — My Notes joined task/chat/
                                shared when it gained the folder forest. */}
                            {config.renderGrouped ? config.renderGrouped() : null}
                        </NoteTypeSection>
                    ))}
                </List>
            </Box>

            {/* My-note folder dialogs — single instances serving every
                folder/note row (rows only set the host state above). */}
            <ModalFolderName
                initialName={folderNameModal?.mode === "rename" ? folderNameModal.folder.name : ""}
                mode={folderNameModal?.mode ?? "create"}
                open={folderNameModal !== null}
                onClose={() => setFolderNameModal(null)}
                onSubmit={(name) => {
                    if (!folderNameModal) return;
                    if (folderNameModal.mode === "create") {
                        void useNM.createMyNoteFolder(name, folderNameModal.parentFolderId);
                    } else {
                        void useNM.renameMyNoteFolder(folderNameModal.folder.folderId, name);
                    }
                }}
            />
            <ModalMoveToFolder
                folders={useNM.myNoteFolders}
                open={moveModal !== null}
                showDetachHint={moveModal?.kind === "note" && moveModal.isChild}
                currentFolderId={
                    moveModal?.kind === "note"
                        ? moveModal.currentFolderId
                        : (moveModal?.folder.parentFolderId ?? null)
                }
                movingFolderId={
                    moveModal?.kind === "folder" ? moveModal.folder.folderId : undefined
                }
                onClose={() => setMoveModal(null)}
                onSelect={(folderId) => {
                    if (!moveModal) return;
                    if (moveModal.kind === "note") {
                        void useNM.moveMyNoteToFolder(moveModal.noteId, folderId);
                    } else {
                        void useNM.moveMyNoteFolder(moveModal.folder.folderId, folderId);
                    }
                }}
            />
            <ModalDeleteFolder
                folderName={deleteFolderModal?.name ?? ""}
                open={deleteFolderModal !== null}
                onClose={() => setDeleteFolderModal(null)}
                onConfirm={() => {
                    if (deleteFolderModal) {
                        void useNM.deleteMyNoteFolder(deleteFolderModal.folderId);
                    }
                }}
            />

            {/* Footer */}
            <Divider sx={{ opacity: isDark ? 0.08 : 0.12 }} />
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                        fontSize: 10,
                    }}
                >
                    {t.notes.sidebar.footerTagline}
                </Typography>
            </Box>
        </Sheet>
    );
};
