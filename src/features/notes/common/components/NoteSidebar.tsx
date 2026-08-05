import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import MarkChatUnreadRoundedIcon from "@mui/icons-material/MarkChatUnreadRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import {
    Box,
    Button,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemContent,
    Modal,
    ModalDialog,
    Sheet,
    Typography,
} from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, Messages, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import {
    ChatNoteMetaProps,
    MyNoteFolderTreeNode,
    MyNoteMetaProps,
    MyNoteMetaTreeNode,
    NoteFolderTagProps,
    SharedNoteMetaTreeNode,
    TaskNoteMetaProps,
    TeamNoteFolderTreeNode,
} from "../../../../types/notes";
import { relayCrossTeamRequest } from "../../../admin/services/crossTeamNotice";
import { offerExternalShare } from "../../../admin/services/teamConnections";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { ChildNoteCreator } from "../../chat-notes/components/ChildNoteCreator";
import {
    FolderActionHandlers,
    MyNoteFolderTree,
} from "../../my-notes/components/MyNoteFolderTree";
import { ModalDeleteFolder } from "../../my-notes/modals/ModalDeleteFolder";
import { ModalFolderName } from "../../my-notes/modals/ModalFolderName";
import { ModalMoveToFolder } from "../../my-notes/modals/ModalMoveToFolder";
import {
    TeamFolderActionHandlers,
    TeamNoteFolderTree,
} from "../../team-notes/components/TeamNoteFolderTree";
import { ModalTeamFolderMembers } from "../../team-notes/modals/ModalTeamFolderMembers";
import { ModalTeamFolderName } from "../../team-notes/modals/ModalTeamFolderName";
import { folderTagChipSx, ModalTeamFolderTags } from "../../team-notes/modals/ModalTeamFolderTags";
import { isInGuestFolder, splitFoldersByOwnership } from "../../team-notes/utils/guestFolders";
import { useNoteUnread } from "../context/NoteUnreadContext";
import {
    chatContainerId,
    DraggableNoteRow,
    DroppableHeader,
    DroppableNoteList,
    myRootContainerId,
    SidebarDndProvider,
    SidebarNoteMove,
    taskContainerId,
} from "../dnd/sidebarNoteDnd";
import { useNoteTreeState } from "../hooks/useNoteTreeState";
import { exportNoteMarkdown } from "../services/exportNoteMarkdown";
import { ChatNoteMetaTreeNode, TaskNoteMetaTreeNode } from "../types/noteTypes";
import { isPersonalNoteBucket, toBackendNoteType } from "../utils/noteTypeAlias";
import { FavoriteNoteItem } from "./FavoriteNoteItem";
import { FavoriteNoteSection } from "./FavoriteNoteSection";
import { GroupedNoteSection } from "./GroupedNoteSection";
import { ModalDeleteNote } from "./ModalDeleteNote";
import { ImportMarkdownContext, ModalImportMarkdown } from "./ModalImportMarkdown";
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
    // The milestone's backing task id + human-readable id, so the folder
    // sub-label can show the milestone's display id (e.g. "GEN-12") the
    // same way a task folder shows its own — rather than the literal word
    // "Milestone". Captured opportunistically from whichever child note
    // reveals the backing task (a direct milestone note, or a task note
    // whose parent IS the backing task). Null when no note reveals it.
    backingTaskId: number | null;
    displayId: string | null;
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
    // Anchor new notes created from this folder's "⋯" menu the way the
    // folder's existing notes are anchored. A chat folder can mix
    // channel-level and thread-level notes (the grouping keys on chatId
    // alone), so prefer a channel-level one and fall back to the first
    // note — see `groupChatNotes`.
    isThread: boolean;
    threadId?: number;
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
        milestoneTitle: string,
        backingTaskId?: number | null,
        displayId?: string | null
    ): MilestoneGroup => {
        let mg = pg.milestones.find((m) => m.milestoneId === milestoneId);
        if (!mg) {
            mg = {
                milestoneId,
                milestoneTitle:
                    milestoneTitle || fmt(t.notes.defaults.milestoneFallback, { milestoneId }),
                backingTaskId: backingTaskId ?? null,
                displayId: displayId ?? null,
                directNotes: [],
                tasks: [],
            };
            pg.milestones.push(mg);
        } else {
            // Upgrade in place once a note reveals the backing task —
            // the first note in the group may not have carried it.
            if (mg.backingTaskId == null && backingTaskId != null) {
                mg.backingTaskId = backingTaskId;
            }
            if (mg.displayId == null && displayId != null) {
                mg.displayId = displayId;
            }
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

        // Whether the note's task hangs directly off the milestone's
        // backing task — computed up front so both the milestone-group
        // lookup (to learn the backing task's display id) and the L2/L3
        // placement below can read it.
        const parentIsMilestoneBacking = note.parentTaskIsMilestone === true;

        // Case 1: the note's task IS a milestone's backing task. The note
        // attaches to the milestone level itself (`directNotes`), not to
        // any task folder. This note directly names the backing task, so
        // pass its id/displayId to seed the milestone folder's sub-label.
        if (note.isMilestone === true && note.milestoneId != null) {
            const mg = getMilestoneGroup(
                pg,
                note.milestoneId,
                note.milestoneTitle ?? "",
                note.taskId,
                note.displayId ?? null
            );
            mg.directNotes.push(note);
            continue;
        }

        // Choose the bucket of L2 tasks: inside a milestone or "loose"
        // tasks directly under the project. When the note's parent IS the
        // milestone backing task, its `parentTask*` fields describe that
        // backing task — the milestone's own display id.
        let bucketTasks: TaskGroup[];
        if (note.milestoneId != null) {
            const mg = getMilestoneGroup(
                pg,
                note.milestoneId,
                note.milestoneTitle ?? "",
                parentIsMilestoneBacking ? (note.parentTaskId ?? null) : null,
                parentIsMilestoneBacking ? (note.parentTaskDisplayId ?? null) : null
            );
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
                isThread: note.isThread,
                threadId: note.threadId,
                notes: [],
            };
            chatTypeGroup.chats.push(chatGroup);
        } else if (chatGroup.isThread && !note.isThread) {
            // A channel-level note showed up later — prefer it as the
            // folder's anchor (see ChatGroup).
            chatGroup.isThread = false;
            chatGroup.threadId = note.threadId;
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
    // `myself` also backs the row menus' markdown export (note re-fetch).
    //
    // The task-note project rows render the real `ProjectAvatar`, which
    // hosts the project-profile modal — hence the profile-modal props
    // (setMyself / socket / useTEM / useUISM) on a component that
    // otherwise only needs `useNM`. Same set `ChatListItemAvatar` threads
    // through the chat sidebar for the same reason.
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};

export const NoteSidebar = (props: NoteSidebarProps) => {
    const { useNM, myself, setMyself, socket, useTEM, useCM, useUISM } = props;
    const allChats = useCM.allChats;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const { accessToken } = useAuth();
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
                  : // A personal-backed note can be in any of the three
                    // lists; searching only `myNoteMeta` left team and
                    // shared rows title-less (falling back to the stub).
                    (useNM.myNoteMeta.find((n) => n.noteId === noteId) ??
                    useNM.teamNoteMeta.find((n) => n.noteId === noteId) ??
                    useNM.sharedNoteMeta.find((n) => n.noteId === noteId));
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
                // The activity feed only knows backend types, so a
                // personal-backed row has to be resolved to its bucket
                // here — same as Recents and Favorites.
                const bucket = n.noteType === 1 ? personalBucketFor(n.noteId) : n.noteType;
                return (
                    <RecentNoteItem
                        key={`unread-${bucket}-${n.noteId}`}
                        note={meta}
                        noteType={bucket}
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

    // Team Notes (noteType=8 bucket): the folder list and the notes
    // inside it are separate calls, because the folders ARE the ACL and
    // the server resolves them before it can say which notes you see.
    useEffect(() => {
        void useNM.getTeamNoteFolders();
        void useNM.getTeamNoteMeta();
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

    // Team notes are personal notes, so — like shared notes — the row
    // highlight tracks `currentMyNote`.
    const teamNoteState = useNoteTreeState<MyNoteMetaTreeNode>({
        metaTree: useNM.teamNoteMetaTree,
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

    // ------------------------------------------------------------------
    // Team-note folder dialogs. Kept separate from the My Notes ones
    // because a team folder also carries visibility and a roster.
    // ------------------------------------------------------------------
    const [teamFolderModal, setTeamFolderModal] = useState<
        | { mode: "create-root" }
        | { mode: "create-child"; parent: TeamNoteFolderTreeNode }
        | { mode: "rename"; folder: TeamNoteFolderTreeNode }
        | null
    >(null);
    const [teamMembersModal, setTeamMembersModal] = useState<TeamNoteFolderTreeNode | null>(null);
    const [teamTagsModal, setTeamTagsModal] = useState<TeamNoteFolderTreeNode | null>(null);
    // Moving a NOTE between team folders. Separate from `teamMoveModal`,
    // which moves a FOLDER — the two pick from the same tree but write
    // through different endpoints.
    const [teamNoteMoveModal, setTeamNoteMoveModal] = useState<{
        noteId: number;
        currentFolderId: number | null;
        isChild: boolean;
    } | null>(null);
    const [teamTagFilter, setTeamTagFilter] = useState<Set<number>>(new Set());
    const [teamMoveModal, setTeamMoveModal] = useState<TeamNoteFolderTreeNode | null>(null);
    const [teamDeleteModal, setTeamDeleteModal] = useState<TeamNoteFolderTreeNode | null>(null);
    // Populated when the server REFUSES a delete because the subtree
    // still holds other people's content (409).
    const [teamDeleteBlocked, setTeamDeleteBlocked] = useState<{
        noteCount: number;
        folderCount: number;
    } | null>(null);
    // Note deletion straight from a sidebar "⋯" row menu (my / task /
    // chat) — one confirm dialog serves every row. `hasChildren` is read
    // off the tree node so the dialog can block deletion of a parent note
    // up front (same guard as the note-header delete).
    const [deleteNoteModal, setDeleteNoteModal] = useState<{
        noteType: number;
        noteId: number;
        title: string;
        hasChildren: boolean;
    } | null>(null);

    // "Import Markdown…" opened from a sidebar folder row: the folder IS
    // the destination, so the dialog gets a fixed context and shows no
    // destination picker (unlike the note-header path).
    const [importModalContext, setImportModalContext] = useState<ImportMarkdownContext | null>(
        null
    );

    // Builds the shared "Export as Markdown" row-menu item for any note
    // row. Sidebar buckets 4 (shared) and 8 (team) are UI-only aliases
    // of personal notes, so the export goes out as type 1 — see
    // `toBackendNoteType`.
    const buildExportMenuItem = (
        noteType: number,
        node: { noteId: number; title: string }
    ): MoreMenuItem => ({
        id: "export-note",
        label: t.notes.header.exportMarkdown,
        icon: <FileDownloadRoundedIcon sx={{ fontSize: 16 }} />,
        onClick: () => {
            void exportNoteMarkdown({
                myself,
                noteType: toBackendNoteType(noteType),
                noteId: node.noteId,
                accessToken,
                fallbackTitle: node.title,
            });
        },
    });

    // Folder-row menu shared by the task and chat sections: create a note
    // in this folder, or import one from a markdown file. `onCreate`
    // carries the folder's own anchor, so the new note lands with the
    // same metadata as its siblings.
    const buildFolderMenuItems = (
        onCreate: () => void,
        importContext: ImportMarkdownContext
    ): MoreMenuItem[] => [
        {
            id: "new-note-here",
            label: t.notes.folders.newNoteHere,
            icon: <NoteAddRoundedIcon sx={{ fontSize: 16 }} />,
            onClick: onCreate,
        },
        {
            id: "import-note-here",
            label: t.notes.header.importMarkdown,
            icon: <FileUploadRoundedIcon sx={{ fontSize: 16 }} />,
            onClick: () => setImportModalContext(importContext),
        },
    ];

    // Folder menu for one task (task / subtask / milestone-backing task).
    const buildTaskFolderMenuItems = (projectId: number, taskId: number): MoreMenuItem[] =>
        buildFolderMenuItems(() => void useNM.handleCreateNewTaskNote(null, projectId, taskId), {
            kind: "task",
            projectId,
            taskId,
        });

    const buildChatFolderMenuItems = (chatGroup: ChatGroup): MoreMenuItem[] | undefined => {
        const { chatType, chatId, isThread, threadId } = chatGroup;
        // The tree node types `threadId` as optional even though the chat
        // note meta always carries it. Rather than invent an anchor, drop
        // the menu on the (unreachable) row that lacks one.
        if (threadId == null) return undefined;
        return buildFolderMenuItems(
            () => void useNM.handleCreateNewChatNote(null, chatType, chatId, isThread, threadId),
            { kind: "chat", chatType, chatId, isThread, threadId }
        );
    };

    // Builds the shared "Delete" row-menu item for any note row. Kept out
    // of the per-type render helpers so my / task / chat stay consistent.
    const buildDeleteMenuItem = (
        noteType: number,
        node: { noteId: number; title: string; children: unknown[] }
    ): MoreMenuItem => ({
        id: "delete-note",
        label: t.notes.header.deleteNote,
        icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />,
        danger: true,
        onClick: () =>
            setDeleteNoteModal({
                noteType,
                noteId: node.noteId,
                title: node.title || t.notes.defaults.untitled,
                hasChildren: node.children.length > 0,
            }),
    });

    const folderActions: FolderActionHandlers = {
        onCreateNoteHere: (folderId) => {
            void useNM.handleCreateNewMyNote(null, folderId);
        },
        onImportNoteHere: (folderId) => setImportModalContext({ kind: "my", folderId }),
        onCreateSubfolder: (folderId) =>
            setFolderNameModal({ mode: "create", parentFolderId: folderId }),
        onRenameFolder: (folder) => setFolderNameModal({ mode: "rename", folder }),
        onMoveFolder: (folder) => setMoveModal({ kind: "folder", folder }),
        onDeleteFolder: (folder) => setDeleteFolderModal(folder),
    };

    // Sidebar-DnD drop dispatch. `parseDropResult` already filtered
    // no-ops (same container, cross-kind, outside targets).
    const handleSidebarMove = (move: SidebarNoteMove) => {
        if (move.kind === "my") {
            void useNM.moveMyNoteToFolder(move.noteId, move.folderId);
        } else if (move.kind === "task") {
            void useNM.moveTaskNoteToTask(move.noteId, move.projectId, move.taskId);
        } else {
            void useNM.moveChatNoteToChat(move.noteId, move.chatType, move.channelId);
        }
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
                buildExportMenuItem(1, node),
                buildDeleteMenuItem(1, node),
            ]}
        />
    );

    // My Notes section: user folders (nested) + unfiled root notes,
    // headed by a subtle "New folder" affordance. Task/chat sections
    // keep their derived (task/chat-anchored) grouping.
    //
    // Box root ON PURPOSE (not a Fragment): NoteTypeSection renders this
    // inside a Joy <List>, which clones its first child with a
    // `data-first-child` prop — a Fragment root triggers React's
    // "Invalid prop supplied to React.Fragment" warning. The grouped
    // task/chat/shared sections are Box-rooted for the same reason.
    const renderMyNotesSection = () => (
        <Box>
            {/* "New folder" affordance — doubles as the always-visible
                "move to root" drop target (folders below may be the only
                other rows when every note is filed). */}
            <ListItem>
                <DroppableHeader containerId={myRootContainerId()} kind={1}>
                    {(isDraggingOver) => (
                        <ListItemButton
                            sx={{
                                borderRadius: "8px",
                                py: 0.5,
                                px: 1,
                                my: 0.25,
                                gap: 0.75,
                                minHeight: 30,
                                border: "1px dashed",
                                borderColor: isDraggingOver
                                    ? isDark
                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.8)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.7)"
                                    : isDark
                                      ? "rgba(255,255,255,0.15)"
                                      : "rgba(0,0,0,0.12)",
                                backgroundColor: isDraggingOver
                                    ? isDark
                                        ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.08)"
                                    : "transparent",
                                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                                "&:hover": {
                                    borderColor: isDark
                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.6)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.5)",
                                    color: isDark
                                        ? "var(--gp-brandalt-400)"
                                        : "var(--gp-brand-700)",
                                },
                            }}
                            onClick={() =>
                                setFolderNameModal({ mode: "create", parentFolderId: null })
                            }
                        >
                            <CreateNewFolderRoundedIcon sx={{ fontSize: 15 }} />
                            <Typography level="body-xs" sx={{ fontWeight: 500, color: "inherit" }}>
                                {t.notes.folders.newFolder}
                            </Typography>
                        </ListItemButton>
                    )}
                </DroppableHeader>
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
            <DroppableNoteList containerId={myRootContainerId()} kind={1}>
                {useNM.myNoteFolderForest.rootNotes.map((root, index) => (
                    <DraggableNoteRow
                        key={`root-note-${root.noteId}`}
                        index={index}
                        kind={1}
                        noteId={root.noteId}
                    >
                        {renderMyNoteTree(root)}
                    </DraggableNoteRow>
                ))}
            </DroppableNoteList>
        </Box>
    );

    const renderTaskNoteTreeItem = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={taskNoteState.tmpCurrentChain}
            node={node}
            noteType={2}
            rowMenuItems={(node) => [buildExportMenuItem(2, node), buildDeleteMenuItem(2, node)]}
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
            rowMenuItems={(node) => [buildExportMenuItem(3, node), buildDeleteMenuItem(3, node)]}
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
            rowMenuItems={(node) => [buildExportMenuItem(4, node)]}
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

    // Team notes render exactly like My Notes rows — they ARE personal
    // notes — but pass noteType={8} so the sidebar highlight tracks the
    // Team Notes bucket rather than My Notes.
    // Can this user edit the folder the note sits in? Move and delete
    // are folder-scoped, not note-scoped: the server gates them on
    // folder role, so a viewer shouldn't be offered actions that 403.
    const canEditTeamNote = (node: { folderId?: number | null }): boolean => {
        const folder = useNM.teamNoteFolders.find((f) => f.folderId === node.folderId);
        return folder != null && folder.myRoleId < 3;
    };

    const renderTeamNoteTreeItem = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={teamNoteState.tmpCurrentChain}
            node={node}
            noteType={8}
            rowMenuItems={(node: MyNoteMetaTreeNode) =>
                canEditTeamNote(node)
                    ? [
                          {
                              id: "move-to-folder",
                              label: t.notes.folders.moveToFolder,
                              icon: <DriveFileMoveRoundedIcon sx={{ fontSize: 16 }} />,
                              onClick: () =>
                                  setTeamNoteMoveModal({
                                      noteId: node.noteId,
                                      currentFolderId: node.folderId ?? null,
                                      isChild: node.parentNoteId != null,
                                  }),
                          },
                          buildExportMenuItem(8, node),
                          buildDeleteMenuItem(8, node),
                      ]
                    : [buildExportMenuItem(8, node)]
            }
            timestamp={teamNoteState.timestamp}
            useNM={useNM}
            createChildNoteList={(node) => (
                <ChildNoteCreator node={node} timestamp={teamNoteState.timestamp} useNM={useNM} />
            )}
        />
    );

    const teamFolderActions: TeamFolderActionHandlers = {
        onCreateNoteHere: (folderId) => {
            void useNM.handleCreateNewMyNote(null, folderId);
        },
        onImportNoteHere: (folderId) => setImportModalContext({ kind: "my", folderId }),
        onCreateSubfolder: (parent) => setTeamFolderModal({ mode: "create-child", parent }),
        onRenameFolder: (folder) => setTeamFolderModal({ mode: "rename", folder }),
        onMoveFolder: (folder) => setTeamMoveModal(folder),
        onManageMembers: (folder) => setTeamMembersModal(folder),
        onEditTags: (folder) => setTeamTagsModal(folder),
        onDeleteFolder: (folder) => setTeamDeleteModal(folder),
    };

    // Tag filter. Filtering keeps a folder's ANCESTORS visible even when
    // they don't carry the tag themselves — otherwise a matching
    // subfolder would vanish along with its unmatched parent, and the
    // filter would look broken rather than selective.
    const visibleTeamFolderIds = useMemo<Set<number> | null>(() => {
        if (teamTagFilter.size === 0) return null;
        const byId = new Map(useNM.teamNoteFolders.map((f) => [f.folderId, f]));
        const keep = new Set<number>();
        for (const folder of useNM.teamNoteFolders) {
            if (!folder.tags.some((tg) => teamTagFilter.has(tg.tagId))) continue;
            let cursor: number | null = folder.folderId;
            const seen = new Set<number>();
            while (cursor != null && !seen.has(cursor)) {
                seen.add(cursor);
                keep.add(cursor);
                cursor = byId.get(cursor)?.parentFolderId ?? null;
            }
        }
        return keep;
    }, [teamTagFilter, useNM.teamNoteFolders]);

    // Every tag actually in use, so the filter row never offers a chip
    // that would match nothing. Our folders only: the chips sit in the
    // Team Notes section and filter it, and a lent folder is shown in
    // another section entirely — offering the host's tag here would be a
    // control that empties the list under it and changes something
    // elsewhere.
    const teamFolderTags = useMemo(() => {
        // Keep the whole tag, not just id+name — the filter chips render
        // in the user's chosen colour, same as the folder-row chips.
        const map = new Map<number, NoteFolderTagProps>();
        useNM.teamNoteFolders
            .filter((f) => f.isExternal !== true)
            .forEach((f) => f.tags.forEach((tg) => map.set(tg.tagId, tg)));
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [useNM.teamNoteFolders]);

    // Ours stay in Team Notes; the ones another team lent us move to
    // Shared Notes, where everything else somebody shared with us already
    // is. The owning team still sees theirs under Team Notes — from their
    // side it isn't shared-in, it's theirs.
    const [ownRootFolders, guestRootFolders] = useMemo(
        () => splitFoldersByOwnership(useNM.teamNoteFolderForest.rootFolders),
        [useNM.teamNoteFolderForest.rootFolders]
    );

    // The open note sits in a folder another team shared with us, so its
    // row is under Shared Notes — while the note itself stays a TEAM note
    // (bucket 8) for the tab, the deep-link reveal and the delete path,
    // all of which are keyed on the bucket. So the section highlight is
    // redirected here instead of the note being relabelled, which would
    // silently collapse the tree it lives in.
    const openNoteIsInGuestFolder = useMemo(() => {
        const noteId = useNM.currentMyNote?.noteId;
        if (useNM.currentNoteType !== 8 || noteId == null) return false;
        const row = useNM.teamNoteMeta.find((n) => n.noteId === noteId);
        return row != null && isInGuestFolder(useNM.teamNoteFolders, row.folderId);
    }, [
        useNM.currentNoteType,
        useNM.currentMyNote?.noteId,
        useNM.teamNoteMeta,
        useNM.teamNoteFolders,
    ]);

    // Same trees either way: a shared folder is still a team folder, with
    // the same rows, actions and role checks. Only which section it hangs
    // under changes.
    //
    // `visibleFolderIds` is passed per call rather than read from the
    // closure, because the tag filter belongs to the section whose chips
    // set it. Applied to both, toggling a chip in Team Notes would add or
    // remove a folder from Shared Notes, which is a filter reaching
    // outside the list it is attached to.
    const renderTeamFolderTrees = (
        folders: typeof ownRootFolders,
        visibleFolderIds: Set<number> | null
    ) =>
        folders
            .filter((f) => !visibleFolderIds || visibleFolderIds.has(f.folderId))
            .map((folder) => (
                <TeamNoteFolderTree
                    key={`team-folder-${folder.folderId}`}
                    actions={teamFolderActions}
                    folder={folder}
                    renderNote={renderTeamNoteTreeItem}
                    useNM={useNM}
                    visibleFolderIds={visibleFolderIds}
                />
            ));

    // Team Notes section: the folder forest, headed by a "New team
    // folder" affordance. No drop targets — moving a note between team
    // folders crosses an ACL boundary, so it goes through the explicit
    // move dialog rather than a drag.
    //
    // Box root ON PURPOSE — see renderMyNotesSection.
    const renderTeamNotesSection = () => (
        <Box>
            {/* Creating a folder in Team Notes is member-only on the server.
                A guest sees this section for the one folder shared with their
                team, so the affordance would only ever fail for them. */}
            {!useTEM.currentTeam.isGuest && (
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
                                borderColor: isDark
                                    ? "rgba(var(--gp-brandalt-400-rgb), 0.6)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.5)",
                                color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                            },
                        }}
                        onClick={() => setTeamFolderModal({ mode: "create-root" })}
                    >
                        <CreateNewFolderRoundedIcon sx={{ fontSize: 15 }} />
                        <Typography level="body-xs" sx={{ fontWeight: 500, color: "inherit" }}>
                            {t.notes.teamNotes.newFolder}
                        </Typography>
                    </ListItemButton>
                </ListItem>
            )}
            {teamFolderTags.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, px: 1, py: 0.5 }}>
                    {teamFolderTags.map((tag) => {
                        const isOn = teamTagFilter.has(tag.tagId);
                        return (
                            // Handler on the wrapper, not the Chip: a Joy
                            // Chip with `onClick` paints a ChipAction
                            // overlay over the root and swallows the tag
                            // colour. Selection reads as full opacity +
                            // a ring rather than a colour change, so the
                            // tag stays recognisable either way.
                            <Box
                                key={tag.tagId}
                                role="button"
                                tabIndex={0}
                                sx={{
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    display: "flex",
                                    outline: isOn ? "2px solid" : "none",
                                    outlineColor: isDark
                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.9)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.7)",
                                    outlineOffset: "1px",
                                }}
                                onClick={() =>
                                    setTeamTagFilter((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(tag.tagId)) next.delete(tag.tagId);
                                        else next.add(tag.tagId);
                                        return next;
                                    })
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setTeamTagFilter((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(tag.tagId)) next.delete(tag.tagId);
                                            else next.add(tag.tagId);
                                            return next;
                                        });
                                    }
                                }}
                            >
                                <Chip
                                    size="sm"
                                    variant="solid"
                                    sx={{
                                        ...folderTagChipSx(tag),
                                        opacity: isOn ? 1 : 0.5,
                                    }}
                                >
                                    {tag.name}
                                </Chip>
                            </Box>
                        );
                    })}
                </Box>
            )}
            {ownRootFolders.length === 0 ? (
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            fontStyle: "italic",
                        }}
                    >
                        {t.notes.teamNotes.emptySpace}
                    </Typography>
                </Box>
            ) : (
                renderTeamFolderTrees(ownRootFolders, visibleTeamFolderIds)
            )}
        </Box>
    );

    // A project's PM channel, which carries the project avatar. Same join
    // key as `TaskNoteMain`: post-v3-flip a PM chat's `chatId` is the
    // channel UUID, so match on the numeric `project.projectId` and keep
    // the legacy id compare as a fallback for pre-migration rows.
    const findPmChat = (projectId: number) =>
        allChats.find(
            (chat) =>
                chat.chatType === 3 &&
                (chat.project?.projectId === projectId || chat.chatId === String(projectId))
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
        activeNoteId: number | undefined,
        projectId: number
    ) => (
        <GroupedNoteSection
            key={`${keyPrefix}-task-${taskGroup.taskId}`}
            defaultExpanded={taskGroupContainsNote(taskGroup, activeNoteId)}
            droppableId={taskContainerId(projectId, taskGroup.taskId)}
            droppableKind={2}
            groupKey={`${keyPrefix}-task-${taskGroup.taskId}`}
            groupLabel={taskGroup.taskTitle}
            menuItems={buildTaskFolderMenuItems(projectId, taskGroup.taskId)}
            subLabel={formatTaskDisplayId({
                taskId: taskGroup.taskId,
                displayId: taskGroup.displayId,
            })}
        >
            <DroppableNoteList containerId={taskContainerId(projectId, taskGroup.taskId)} kind={2}>
                {taskGroup.notes.map((note, index) => (
                    <DraggableNoteRow
                        key={`task-note-${note.noteId}`}
                        index={index}
                        kind={2}
                        noteId={note.noteId}
                    >
                        {renderTaskNoteTreeItem(note)}
                    </DraggableNoteRow>
                ))}
            </DroppableNoteList>
            {taskGroup.subtasks.map((subGroup) => (
                <GroupedNoteSection
                    key={`${keyPrefix}-task-${taskGroup.taskId}-sub-${subGroup.taskId}`}
                    defaultExpanded={subGroup.notes.some((n) => n.noteId === activeNoteId)}
                    droppableId={taskContainerId(projectId, subGroup.taskId)}
                    droppableKind={2}
                    groupKey={`${keyPrefix}-task-${taskGroup.taskId}-sub-${subGroup.taskId}`}
                    groupLabel={subGroup.taskTitle}
                    menuItems={buildTaskFolderMenuItems(projectId, subGroup.taskId)}
                    subLabel={formatTaskDisplayId({
                        taskId: subGroup.taskId,
                        displayId: subGroup.displayId,
                    })}
                >
                    <DroppableNoteList
                        containerId={taskContainerId(projectId, subGroup.taskId)}
                        kind={2}
                    >
                        {subGroup.notes.map((note, index) => (
                            <DraggableNoteRow
                                key={`task-note-${note.noteId}`}
                                index={index}
                                kind={2}
                                noteId={note.noteId}
                            >
                                {renderTaskNoteTreeItem(note)}
                            </DraggableNoteRow>
                        ))}
                    </DroppableNoteList>
                </GroupedNoteSection>
            ))}
        </GroupedNoteSection>
    );

    // The project's avatar for a project folder row, or undefined to keep
    // the default folder glyph when the project's PM channel isn't loaded.
    //
    // Clicking it opens the project profile (same as everywhere else the
    // avatar appears) — `stopPropagation` keeps that click off the row,
    // whose own job is expand/collapse.
    const renderProjectLeadingIcon = (projectId: number) => {
        const pmChat = findPmChat(projectId);
        if (!pmChat) return undefined;
        return (
            <Box sx={{ display: "flex", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <ProjectAvatar
                    avatarSize={18}
                    myself={myself}
                    pmChat={pmChat}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Box>
        );
    };

    // The chat's own avatar for a chat-note folder row — the same glyph
    // the chat header and the chat sidebar show for that channel, so a
    // DM folder reads as its partner, a GM/PM folder as its group image,
    // and an MDM folder as its overlapping member stack. Mirrors
    // `renderProjectLeadingIcon` above (18px, click passes through to the
    // avatar's own profile modal, not the row's expand/collapse).
    //
    // Returns undefined when the channel isn't in `allChats` yet, which
    // keeps the default folder glyph rather than rendering a blank.
    //
    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is `string`
    // post-flip while `ChatGroup.chatId` is still the legacy `number`, so
    // the compare stringifies — same as `groupChatNotesByType` above.
    const renderChatLeadingIcon = (chatGroup: ChatGroup) => {
        const chat = allChats.find(
            (c) => c.chatType === chatGroup.chatType && c.chatId === String(chatGroup.chatId)
        );
        if (!chat) return undefined;

        // Presence dots are suppressed on every branch: a folder row is a
        // location, not a presence surface, and `UserAvatar`'s dot
        // placement is calibrated for 26/32px — at 18 it floats outside
        // the circle. (MDMAvatar draws dots only when handed
        // `teamMemberProfiles`, so omitting that prop is its opt-out.)
        let avatar: ReactNode;
        if (chatGroup.chatType === 1 && chat.dmPartnerUser?.userId) {
            avatar = (
                <AvatarWithStatus
                    avatarSize={18}
                    avatarUser={useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                    chat={chat}
                    isYou={chat.dmPartnerUser.userId === myself.userId}
                    myself={myself}
                    setMyself={setMyself}
                    showPulseDot={false}
                    socket={socket}
                    useCM={useCM}
                    useUISM={useUISM}
                />
            );
        } else if (chatGroup.chatType === 2) {
            avatar = (
                <GMAvatar
                    avatarSize={18}
                    gmChat={chat}
                    isYou={false}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        } else if (chatGroup.chatType === 3) {
            avatar = (
                <ProjectAvatar
                    avatarSize={18}
                    myself={myself}
                    pmChat={chat}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        } else if (chatGroup.chatType === 4) {
            avatar = <MDMAvatar avatarSize={18} members={chat.mdmMembers} />;
        } else {
            return undefined;
        }

        return (
            <Box sx={{ display: "flex", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                {avatar}
            </Box>
        );
    };

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
                    // The project's own avatar in place of the generic
                    // folder glyph, so a project root reads the same here
                    // as it does in the task-note header.
                    leadingIcon={renderProjectLeadingIcon(projectGroup.projectId)}
                >
                    {projectGroup.milestones.map((milestoneGroup) => {
                        const milestoneKey = `${projectKey}-milestone-${milestoneGroup.milestoneId}`;
                        return (
                            <GroupedNoteSection
                                key={milestoneKey}
                                groupKey={milestoneKey}
                                groupLabel={milestoneGroup.milestoneTitle}
                                // Same "<title> <display-id>" shape a task
                                // folder uses; the flag icon marks it as a
                                // milestone (matching the task page). Falls
                                // back to no sub-label when no note revealed
                                // the milestone's backing task id.
                                subLabel={formatTaskDisplayId({
                                    taskId: milestoneGroup.backingTaskId,
                                    displayId: milestoneGroup.displayId,
                                })}
                                // A milestone folder IS a task (its backing
                                // task), so it can hold notes — but only
                                // once a child note has revealed which task
                                // that is.
                                menuItems={
                                    milestoneGroup.backingTaskId != null
                                        ? buildTaskFolderMenuItems(
                                              projectGroup.projectId,
                                              milestoneGroup.backingTaskId
                                          )
                                        : undefined
                                }
                                leadingIcon={
                                    <FlagRoundedIcon
                                        sx={{ color: "#f97316", flexShrink: 0, fontSize: 14 }}
                                    />
                                }
                                defaultExpanded={milestoneGroupContainsNote(
                                    milestoneGroup,
                                    activeNoteId
                                )}
                            >
                                {/* Direct milestone notes all anchor to the
                                    milestone's backing task, so that task is
                                    their DnD container. */}
                                {milestoneGroup.directNotes.length > 0 && (
                                    <DroppableNoteList
                                        kind={2}
                                        containerId={taskContainerId(
                                            projectGroup.projectId,
                                            milestoneGroup.directNotes[0].taskId
                                        )}
                                    >
                                        {milestoneGroup.directNotes.map((note, index) => (
                                            <DraggableNoteRow
                                                key={`task-note-${note.noteId}`}
                                                index={index}
                                                kind={2}
                                                noteId={note.noteId}
                                            >
                                                {renderTaskNoteTreeItem(note)}
                                            </DraggableNoteRow>
                                        ))}
                                    </DroppableNoteList>
                                )}
                                {milestoneGroup.tasks.map((taskGroup) =>
                                    renderTaskGroup(
                                        taskGroup,
                                        milestoneKey,
                                        activeNoteId,
                                        projectGroup.projectId
                                    )
                                )}
                            </GroupedNoteSection>
                        );
                    })}
                    {projectGroup.looseTasks.map((taskGroup) =>
                        renderTaskGroup(
                            taskGroup,
                            projectKey,
                            activeNoteId,
                            projectGroup.projectId
                        )
                    )}
                </GroupedNoteSection>
            );
        });

    // Render shared notes: whole folders another team lent us, then the
    // individual notes people shared (Sharer → Notes).
    //
    // Box root ON PURPOSE — see renderMyNotesSection.
    const renderGroupedSharedNotes = () => (
        <Box>
            {/* Folders first: a folder is the bigger unit, and it is the
                one thing in here that arrived from outside the company
                rather than from a colleague. Unfiltered — the tag chips
                that could narrow these are in the other section. */}
            {renderTeamFolderTrees(guestRootFolders, null)}
            {groupedSharedNotes.map((sharer) => (
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
            ))}
        </Box>
    );

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
                        droppableId={chatContainerId(chatGroup.chatType, chatGroup.chatId)}
                        droppableKind={3}
                        groupKey={`chat-${chatGroup.chatType}-${chatGroup.chatId}`}
                        groupLabel={chatGroup.chatName}
                        // The channel's own avatar in place of the generic
                        // folder glyph, so a chat folder reads the same
                        // here as it does in the chat header / sidebar.
                        leadingIcon={renderChatLeadingIcon(chatGroup)}
                        menuItems={buildChatFolderMenuItems(chatGroup)}
                        defaultExpanded={chatGroup.notes.some(
                            (note) => note.noteId === useNM.currentChatNote?.noteId
                        )}
                    >
                        <DroppableNoteList
                            containerId={chatContainerId(chatGroup.chatType, chatGroup.chatId)}
                            kind={3}
                        >
                            {chatGroup.notes.map((note, index) => (
                                <DraggableNoteRow
                                    key={`chat-note-${note.noteId}`}
                                    index={index}
                                    kind={3}
                                    noteId={note.noteId}
                                >
                                    {renderChatNoteTreeItem(note)}
                                </DraggableNoteRow>
                            ))}
                        </DroppableNoteList>
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

        // The server groups favorites by BACKEND note type, so team (and
        // shared) notes arrive in `personalNotes` — they're note_type 1.
        // Split them back out here, or a favorited team note shows up
        // under "My Notes" with no way to tell it apart.
        const teamNoteIds = new Set(useNM.teamNoteMeta.map((n) => n.noteId));
        const sharedNoteIds = new Set(useNM.sharedNoteMeta.map((n) => n.noteId));
        const favTeamNotes = useNM.favoriteNotes.personalNotes.filter((n) =>
            teamNoteIds.has(n.noteId)
        );
        const favSharedNotes = useNM.favoriteNotes.personalNotes.filter(
            (n) => !teamNoteIds.has(n.noteId) && sharedNoteIds.has(n.noteId)
        );
        const favMyNotes = useNM.favoriteNotes.personalNotes.filter(
            (n) => !teamNoteIds.has(n.noteId) && !sharedNoteIds.has(n.noteId)
        );

        const hasPersonalNotes = favMyNotes.length > 0;
        const hasTeamNotes = favTeamNotes.length > 0;
        const hasSharedNotes = favSharedNotes.length > 0;
        const hasTaskNotes = useNM.favoriteNotes.taskNotes.length > 0;
        const hasChatNotes = useNM.favoriteNotes.chatNotes.length > 0;

        if (
            !hasPersonalNotes &&
            !hasTeamNotes &&
            !hasSharedNotes &&
            !hasTaskNotes &&
            !hasChatNotes
        ) {
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
                        {favMyNotes.map((note) => renderFavoriteNoteItem(note, 1))}
                    </FavoriteNoteSection>
                )}
                {hasSharedNotes && (
                    <FavoriteNoteSection
                        defaultExpanded={true}
                        groupKey="fav-shared"
                        groupLabel={t.notes.sidebar.sharedNotes}
                        icon={<ShareRoundedIcon sx={{ fontSize: 14 }} />}
                    >
                        {favSharedNotes.map((note) => renderFavoriteNoteItem(note, 4))}
                    </FavoriteNoteSection>
                )}
                {hasTeamNotes && (
                    <FavoriteNoteSection
                        defaultExpanded={true}
                        groupKey="fav-team"
                        groupLabel={t.notes.sidebar.teamNotes}
                        icon={<GroupsRoundedIcon sx={{ fontSize: 14 }} />}
                    >
                        {favTeamNotes.map((note) => renderFavoriteNoteItem(note, 8))}
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
    // Same split Favorites does: the server groups recents by BACKEND
    // note type, so team and shared notes arrive inside `personalNotes`
    // (they're all note_type 1). Resolving each row to its sidebar
    // bucket is what gives it the right icon and opens it in the right
    // section.
    const teamNoteIds = useMemo(
        () => new Set(useNM.teamNoteMeta.map((n) => n.noteId)),
        [useNM.teamNoteMeta]
    );
    const sharedNoteIds = useMemo(
        () => new Set(useNM.sharedNoteMeta.map((n) => n.noteId)),
        [useNM.sharedNoteMeta]
    );
    // `useCallback` so the memo below can depend on it honestly rather
    // than closing over a function that changes identity every render.
    const personalBucketFor = useCallback(
        (noteId: number): number =>
            teamNoteIds.has(noteId) ? 8 : sharedNoteIds.has(noteId) ? 4 : 1,
        [teamNoteIds, sharedNoteIds]
    );

    const sortedRecentRows = useMemo<RecentRow[]>(() => {
        const recents = useNM.recentNotes;
        if (!recents) return [];
        const rows: RecentRow[] = [
            ...recents.personalNotes.map((n) => ({
                note: n,
                noteType: personalBucketFor(n.noteId),
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
    }, [useNM.recentNotes, personalBucketFor]);

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
        // Shared Notes sits directly under My Notes: both are personal
        // notes (type 4 is a UI-only alias of 1), so they read as one
        // pair — "mine" then "mine, from someone else" — before the
        // task/chat sections that are anchored to other surfaces.
        {
            noteType: 4,
            icon: <ShareRoundedIcon sx={{ fontSize: 18 }} />,
            title: t.notes.sidebar.sharedNotes,
            state: sharedNoteState,
            renderTree: null,
            renderGrouped: renderGroupedSharedNotes,
            isGrouped: true,
            // Folders lent to us by another team live here, and their
            // notes are bucket 8 — see `openNoteIsInGuestFolder`.
            isSelected: useNM.currentNoteType === 4 || openNoteIsInGuestFolder,
        },
        // Team Notes — the shared "general" space. Sits with the two
        // personal-note buckets it shares storage with (type 8 is the
        // other UI-only alias of 1), above the sections anchored to
        // tasks and channels.
        {
            noteType: 8,
            icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} />,
            title: t.notes.sidebar.teamNotes,
            state: teamNoteState,
            renderTree: null,
            renderGrouped: renderTeamNotesSection,
            isGrouped: true,
            isSelected: useNM.currentNoteType === 8 && !openNoteIsInGuestFolder,
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
                {/* One DragDropContext covers all three note sections so
                    the typed droppables ("note-1|2|3") can reject
                    cross-kind drags for free. */}
                <SidebarDndProvider onMove={handleSidebarMove}>
                    <List
                        size="sm"
                        sx={{
                            gap: 0.5,
                            "--List-nestedInsetStart": "24px",
                            "--ListItem-radius": "8px",
                        }}
                    >
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
                                isSelected={config.isSelected}
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
                </SidebarDndProvider>
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
            {/* "Import Markdown…" from a folder row. The folder itself is
                the destination, so no picker is shown — unlike the note
                header's copy of this dialog. */}
            {importModalContext && (
                <ModalImportMarkdown
                    context={importModalContext}
                    open={importModalContext !== null}
                    useNM={useNM}
                    onClose={() => setImportModalContext(null)}
                />
            )}
            <ModalDeleteNote
                hasChildren={deleteNoteModal?.hasChildren ?? false}
                noteTitle={deleteNoteModal?.title ?? ""}
                open={deleteNoteModal !== null}
                onClose={() => setDeleteNoteModal(null)}
                onConfirm={() => {
                    if (!deleteNoteModal) return;
                    const { noteType, noteId } = deleteNoteModal;
                    // Buckets 4 and 8 are personal notes too, so they
                    // delete through the same action.
                    if (isPersonalNoteBucket(noteType)) void useNM.deleteMyNoteById(noteId);
                    else if (noteType === 2) void useNM.deleteTaskNoteById(noteId);
                    else if (noteType === 3) void useNM.deleteChatNoteById(noteId);
                }}
            />

            {/* Team-folder dialogs — one instance each, driven by the
                state the folder rows set. */}
            <ModalTeamFolderName
                initialName={teamFolderModal?.mode === "rename" ? teamFolderModal.folder.name : ""}
                mode={teamFolderModal?.mode ?? "create-root"}
                open={teamFolderModal !== null}
                parentName={
                    teamFolderModal?.mode === "create-child"
                        ? teamFolderModal.parent.name
                        : undefined
                }
                initialVisibility={
                    teamFolderModal?.mode === "rename"
                        ? teamFolderModal.folder.visibility
                        : undefined
                }
                teamId={myself.teamId}
                onClose={() => setTeamFolderModal(null)}
                onSubmit={(name, visibility, guestTeamIds) => {
                    if (!teamFolderModal) return;
                    if (teamFolderModal.mode === "rename") {
                        void useNM.renameTeamNoteFolder(teamFolderModal.folder.folderId, name);
                        return;
                    }
                    void (async () => {
                        const folder = await useNM.createTeamNoteFolder({
                            name,
                            visibility,
                            parentFolderId:
                                teamFolderModal.mode === "create-child"
                                    ? teamFolderModal.parent.folderId
                                    : null,
                        });
                        if (!folder) return;
                        // One offer per team the user picked, each relayed
                        // so it lands in that team's open inbox instead of
                        // waiting for their next reload.
                        for (const guestTeamId of guestTeamIds) {
                            const offered = await offerExternalShare(accessToken, {
                                guestTeamId,
                                objectId: String(folder.folderId),
                                objectType: "note_folder",
                                teamId: myself.teamId,
                            });
                            if (offered)
                                relayCrossTeamRequest(socket, { grantId: offered.grantId });
                        }
                    })();
                }}
            />
            <ModalTeamFolderMembers
                folder={teamMembersModal}
                myself={myself}
                open={teamMembersModal !== null}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                onClose={() => setTeamMembersModal(null)}
                onChanged={() => {
                    // A grant or revoke can change which folders and
                    // notes this user resolves, so refetch both.
                    void useNM.getTeamNoteFolders();
                    void useNM.getTeamNoteMeta();
                }}
            />
            <ModalTeamFolderTags
                folder={teamTagsModal}
                myself={myself}
                open={teamTagsModal !== null}
                onClose={() => setTeamTagsModal(null)}
                onChanged={() => void useNM.getTeamNoteFolders()}
            />
            {/* Move a NOTE into another team folder. Scoped to the team
                folder list so a team note can't be filed into someone's
                personal sidebar. */}
            <ModalMoveToFolder
                currentFolderId={teamNoteMoveModal?.currentFolderId ?? null}
                folders={useNM.teamNoteFolders}
                open={teamNoteMoveModal !== null}
                showDetachHint={teamNoteMoveModal?.isChild === true}
                onClose={() => setTeamNoteMoveModal(null)}
                onSelect={(folderId) => {
                    if (!teamNoteMoveModal) return;
                    void useNM.moveMyNoteToFolder(teamNoteMoveModal.noteId, folderId);
                }}
            />
            <ModalMoveToFolder
                currentFolderId={teamMoveModal?.parentFolderId ?? null}
                folders={useNM.teamNoteFolders}
                movingFolderId={teamMoveModal?.folderId}
                open={teamMoveModal !== null}
                onClose={() => setTeamMoveModal(null)}
                onSelect={(folderId) => {
                    if (!teamMoveModal) return;
                    void useNM.moveTeamNoteFolder(teamMoveModal.folderId, folderId);
                }}
            />
            <ModalDeleteFolder
                folderName={teamDeleteModal?.name ?? ""}
                open={teamDeleteModal !== null}
                onClose={() => setTeamDeleteModal(null)}
                onConfirm={() => {
                    if (!teamDeleteModal) return;
                    void useNM.deleteTeamNoteFolder(teamDeleteModal.folderId).then((result) => {
                        // The server refuses rather than destroying a
                        // colleague's work; surface exactly what blocked it.
                        if (!result.ok && result.blocked) {
                            setTeamDeleteBlocked({
                                noteCount: result.foreignNoteCount,
                                folderCount: result.foreignFolderCount,
                            });
                        }
                    });
                }}
            />
            <Modal open={teamDeleteBlocked !== null} onClose={() => setTeamDeleteBlocked(null)}>
                <ModalDialog sx={{ maxWidth: 440 }}>
                    <Typography level="title-md">
                        {t.notes.teamNotes.deleteBlockedTitle}
                    </Typography>
                    <Typography level="body-sm" sx={{ mt: 1 }}>
                        {fmt(t.notes.teamNotes.deleteBlockedBody, {
                            noteCount: teamDeleteBlocked?.noteCount ?? 0,
                            folderCount: teamDeleteBlocked?.folderCount ?? 0,
                        })}
                    </Typography>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                        <Button variant="plain" onClick={() => setTeamDeleteBlocked(null)}>
                            {t.notes.folders.cancel}
                        </Button>
                    </Box>
                </ModalDialog>
            </Modal>

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
