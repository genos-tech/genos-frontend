import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatNoteEditorPanel } from "../../../features/notes/chat-notes/components/ChatNoteEditorPanel";
import { ChatNoteMain } from "../../../features/notes/chat-notes/components/ChatNoteMain";
import { NoteAccessRequestPanel } from "../../../features/notes/common/components/NoteAccessRequestPanel";
import { loadSpecificNote } from "../../../features/notes/common/services/loadSpecificNote";
import { MyNoteEditorPanel } from "../../../features/notes/my-notes/components/MyNoteEditorPanel";
import { MyNoteMain } from "../../../features/notes/my-notes/components/MyNoteMain";
import { TaskNoteEditorPanel } from "../../../features/notes/task-notes/components/TaskNoteEditorPanel";
import { TaskNoteMain } from "../../../features/notes/task-notes/components/TaskNoteMain";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { noteToTab, type NoteTab } from "../../../hooks/notes/useNoteTabs";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import {
    ChatNoteMetaProps,
    ChatNoteProps,
    MyNoteMetaProps,
    MyNoteProps,
    TaskNoteMetaProps,
    TaskNoteProps,
} from "../../../types/notes";
import {
    ChatNoteTarget,
    MyNoteTarget,
    SharedNoteTarget,
    TaskNoteTarget,
} from "../../../utils/parseInternalUrl";
import { NoteModalHostZIndexProvider } from "../noteModalHostZIndex";

type NoteTarget = MyNoteTarget | SharedNoteTarget | TaskNoteTarget | ChatNoteTarget;

type ModalNoteViewProps = {
    target: NoteTarget;
    onClose: () => void;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    // Host modal's z-index (UrlLinkModal). Threaded into the note header
    // so its ⋮ MoreMenu — a document.body portal at default z 9999 —
    // lifts above the modal (≥10020) instead of opening behind it.
    hostZIndex?: number;
};

const CenteredMessage = ({ children }: { children: React.ReactNode }) => (
    <Box
        sx={{
            alignItems: "center",
            display: "flex",
            height: "100%",
            justifyContent: "center",
            p: 4,
            width: "100%",
        }}
    >
        <Typography level="body-md" sx={{ color: "neutral.500" }}>
            {children}
        </Typography>
    </Box>
);

// Renders the matching `*NoteMain` against a modal-local note slot so the
// host page's `useNM.currentMyNote / currentTaskNote / currentChatNote`
// stay untouched. Each branch overrides the matching slot plus its
// setter; the tab strips above the editor still read the real
// `useNM.tabItems` / `chatNoteMeta` lists — we feed them a synthetic
// single-entry array so the components don't bail out on the
// "no tabs / no meta" early-return guards.
//
// `setCurrentNoteType` is overridden because the *NoteMain components
// guard on `useNM.currentNoteType !== 0` before rendering, and we want
// to force the type to match the URL kind so the breadcrumb / header
// shows "Shared Notes" vs "My Notes" correctly.
//
// Known limitation (same as the chat / task views): the modal is a
// snapshot at load time. Real-time edits arriving while the modal is
// open don't refresh the preview; close + reopen to refetch.
export const ModalNoteView = (props: ModalNoteViewProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const {
        target,
        onClose,
        accessToken,
        myself,
        setMyself,
        socket,
        useTEM,
        useUISM,
        useCM,
        useTM,
        usePM,
        useNM,
        hostZIndex,
    } = props;

    const { t } = useTranslation();
    const [modalNote, setModalNote] = useState<MyNoteProps | ChatNoteProps | TaskNoteProps | null>(
        null
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // True when the fetch 403s: the note exists but this user has no role
    // on it (the shared-URL case — someone pasted a note link they own).
    const [accessDenied, setAccessDenied] = useState(false);

    // Shared notes live on the personal-note table on the backend, so we
    // transparently alias kind `sharedNote` to `noteType=1` (the FE
    // `currentNoteType` slot is still set to 4 below so the UI shows
    // "Shared Notes" styling). This is also the `note_type` the
    // access-request emit needs when the fetch 403s.
    const backendNoteType =
        target.kind === "myNote" || target.kind === "sharedNote"
            ? 1
            : target.kind === "taskNote"
              ? 2
              : 3;

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setErrorMessage(null);
        setModalNote(null);
        setAccessDenied(false);

        (async () => {
            try {
                const fetched = await loadSpecificNote(
                    myself,
                    backendNoteType,
                    target.noteId,
                    accessToken
                );
                if (cancelled) return;
                if (fetched?.error === "forbidden") {
                    // Offer the request-access flow instead of a dead
                    // "unavailable" message.
                    setAccessDenied(true);
                    setIsLoading(false);
                    return;
                }
                if (!fetched || fetched.error) {
                    setErrorMessage(t.common.modalView.noteUnavailable);
                    setIsLoading(false);
                    return;
                }
                setModalNote(fetched);
                setIsLoading(false);
            } catch (e) {
                if (!cancelled) {
                    console.error("ModalNoteView load failed:", e);
                    setErrorMessage(t.common.modalView.noteLoadFailed);
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [target.kind, target.noteId, accessToken, myself, backendNoteType]);

    // Shared-URL, no role: same request-access panel the full-page note
    // editors show, so the modal path (link clicked in a task preview /
    // chat message) offers the request instead of a dead end.
    if (accessDenied) {
        return (
            <NoteAccessRequestPanel
                noteId={target.noteId}
                noteType={backendNoteType}
                socket={socket}
            />
        );
    }

    if (errorMessage) return <CenteredMessage>{errorMessage}</CenteredMessage>;
    if (isLoading || !modalNote)
        return <CenteredMessage>{t.common.modalView.loadingNote}</CenteredMessage>;

    const wrapper = (children: React.ReactNode) => (
        // Expose the host modal's z to the note's Joy dialogs (Share,
        // Ask, Move-to-folder, History, Delete) so they stack above this
        // preview instead of opening behind it — see noteModalHostZIndex.
        <NoteModalHostZIndexProvider value={hostZIndex}>
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{ height: "100%", overflow: "auto", p: 2, width: "100%" }}
            >
                {children}
            </Box>
        </NoteModalHostZIndexProvider>
    );

    // --- My / Shared note branch ---
    if (target.kind === "myNote" || target.kind === "sharedNote") {
        const note = modalNote as MyNoteProps;
        const internalNoteType = target.kind === "sharedNote" ? 4 : 1;
        // Synthetic single-entry tab list so MyNoteMain's
        // `tabItems.length === 0` early-return (which would otherwise
        // show its EmptyState for users with no my-notes open) doesn't
        // fire. The strip still renders against the real tabsApi, but
        // a click on the placeholder safely no-ops because the lookup
        // misses in the real tabs list.
        const synthTab = {
            id: `modal-my-${note.noteId}`,
            kind: "my",
            noteId: note.noteId,
            noteType: internalNoteType,
            title: note.title,
        };
        const synthMeta: MyNoteMetaProps = {
            noteId: note.noteId,
            noteType: note.noteType,
            parentNoteId: note.parentNoteId,
            title: note.title,
            tsUpdated: note.tsUpdated,
        };
        const useNMOverride: NoteManagementState = {
            ...useNM,
            currentMyNote: note,
            currentNoteType: internalNoteType,
            myNoteMeta: useNM.myNoteMeta.length > 0 ? useNM.myNoteMeta : [synthMeta],
            selectedTabIndex: 0,
            setCurrentMyNote: (next) => {
                if (next) setModalNote(next);
            },
            tabItems: [synthTab],
        };
        // The editor BODY lives in MyNoteEditorPanel; MyNoteMain renders
        // only the header + tab strip. On notes-home the body comes from
        // the LRU pool, on the task page from MyNoteMain's inline
        // `isInTaskPage` path — neither runs in the modal, so we mount the
        // panel ourselves. The canonical `my-${noteId}` tab (forced
        // noteType 1: a shared note is a personal-table note styled as
        // shared) shares the page's useNoteData cache, so the panel
        // self-fetches and renders the body.
        const bodyTab = myself.teamId
            ? (noteToTab(
                  { noteId: note.noteId, noteType: 1, title: note.title },
                  myself.teamId
              ) as NoteTab & { kind: "my" })
            : null;
        return wrapper(
            <>
                <MyNoteMain
                    hostZIndex={hostZIndex}
                    isInTaskPage={false}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNMOverride}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
                {bodyTab && (
                    <MyNoteEditorPanel
                        key={bodyTab.id}
                        accessToken={accessToken}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        tab={bodyTab}
                        useCM={useCM}
                        useNM={useNMOverride}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        isActive
                    />
                )}
            </>
        );
    }

    // --- Task note branch ---
    if (target.kind === "taskNote") {
        const note = modalNote as TaskNoteProps;
        const synthMeta: TaskNoteMetaProps = {
            noteId: note.noteId,
            noteType: note.noteType,
            parentNoteId: note.parentNoteId,
            projectId: note.projectId,
            taskId: note.taskId,
            title: note.title,
            tsUpdated: note.tsUpdated,
        };
        const synthTab = {
            id: `modal-task-${note.noteId}`,
            kind: "task",
            noteId: note.noteId,
            noteType: 2,
            projectId: note.projectId,
            taskId: note.taskId,
            title: note.title,
        };
        const useNMOverride: NoteManagementState = {
            ...useNM,
            currentNoteType: 2,
            currentTaskNote: note,
            selectedTabIndex: 0,
            setCurrentTaskNote: (next) => {
                if (next) setModalNote(next);
            },
            // TaskNoteMain calls `useNM.setIsTaskNoteVisible(false)` when
            // its close button is clicked — route that through to the
            // modal so the X inside the note also closes the dialog.
            setIsTaskNoteVisible: (visible: boolean) => {
                if (!visible) onClose();
            },
            tabItems: [synthTab],
            taskNoteMeta: useNM.taskNoteMeta.length > 0 ? useNM.taskNoteMeta : [synthMeta],
        };
        // Mount the editor body ourselves (see the my-note branch note).
        const bodyTab = myself.teamId
            ? (noteToTab(
                  {
                      noteId: note.noteId,
                      noteType: 2,
                      projectId: note.projectId,
                      taskId: note.taskId,
                      title: note.title,
                  },
                  myself.teamId
              ) as NoteTab & { kind: "task" })
            : null;
        return wrapper(
            <>
                <TaskNoteMain
                    hostZIndex={hostZIndex}
                    isInTaskPage={false}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNMOverride}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />
                {bodyTab && (
                    <TaskNoteEditorPanel
                        key={bodyTab.id}
                        accessToken={accessToken}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        tab={bodyTab}
                        useCM={useCM}
                        useNM={useNMOverride}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        isActive
                    />
                )}
            </>
        );
    }

    // --- Chat note branch ---
    const note = modalNote as ChatNoteProps;
    const synthMeta: ChatNoteMetaProps = {
        chatId: note.chatId,
        chatType: note.chatType,
        isThread: note.isThread,
        noteId: note.noteId,
        noteType: 3,
        parentNoteId: note.parentNoteId,
        threadId: note.threadId,
        title: note.title,
        tsUpdated: note.tsUpdated,
    };
    const synthTab = {
        chatId: note.chatId,
        chatType: note.chatType,
        id: `modal-chat-${note.noteId}`,
        isThread: note.isThread,
        kind: "chat",
        noteId: note.noteId,
        noteType: 3,
        threadId: note.threadId,
        title: note.title,
    };
    const useNMOverride: NoteManagementState = {
        ...useNM,
        chatNoteMeta: useNM.chatNoteMeta.length > 0 ? useNM.chatNoteMeta : [synthMeta],
        currentChatNote: note,
        currentNoteType: 3,
        selectedTabIndex: 0,
        setCurrentChatNote: (next) => {
            if (next) setModalNote(next);
        },
        tabItems: [synthTab],
    };
    // Mount the editor body ourselves (see the my-note branch note).
    const bodyTab = myself.teamId
        ? (noteToTab(
              {
                  chatId: note.chatId,
                  chatType: note.chatType,
                  isThread: note.isThread,
                  noteId: note.noteId,
                  noteType: 3,
                  threadId: note.threadId,
                  title: note.title,
              },
              myself.teamId
          ) as NoteTab & { kind: "chat" })
        : null;
    return wrapper(
        <>
            <ChatNoteMain
                hostZIndex={hostZIndex}
                isInChatPage={false}
                isInTaskPage={false}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useNM={useNMOverride}
                usePM={usePM}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
            {bodyTab && (
                <ChatNoteEditorPanel
                    key={bodyTab.id}
                    accessToken={accessToken}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    tab={bodyTab}
                    useCM={useCM}
                    useNM={useNMOverride}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    isActive
                />
            )}
        </>
    );
};
