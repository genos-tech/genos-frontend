import { useEffect, useRef } from "react";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskNoteEditor } from "../../../../components/editors/bnTaskNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { upsertNoteCache, useNoteData } from "../../../../hooks/notes/useNoteData";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
import { NoteAccessRequestPanel } from "../../common/components/NoteAccessRequestPanel";
import { useNoteAutoSave } from "../../common/hooks/useNoteAutoSave";

interface TaskNoteEditorPanelProps {
    tab: NoteTab & { kind: "task" };
    isActive: boolean;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
}

// Per-tab editor panel for a Task note. Includes the title input and
// "saved" chip overlay (which used to live in TaskNoteTabs's TabPanel).
// Each instance owns its own BlockNote editor + collab provider;
// inactive panels stay mounted via display:none.
export const TaskNoteEditorPanel = ({
    tab,
    isActive,
    accessToken,
    myself,
    setMyself,
    socket,
    useTEM,
    useUISM,
    useCM,
    useNM,
}: TaskNoteEditorPanelProps) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const { note, accessDenied } = useNoteData<TaskNoteProps>(tab, { myself, accessToken });

    const {
        noteBodySaved,
        setNoteBodyEdited,
        setNoteBodySaved,
        body,
        setBody,
        currentTaskNoteTitle,
        handleTitleChange,
        handleTitleBlur,
    } = useNoteAutoSave({
        currentTaskNote: note,
        myself,
        accessToken: accessToken || "",
        socket,
        resyncSignal: useNM.noteResyncNonce,
        onNoteUpdate: (updatedNote: TaskNoteProps) => {
            useNM.tabsApi.updateTabTitle(updatedNote.noteId, "task", updatedNote.title);

            useNM.setTaskNoteMeta(
                useNM.taskNoteMeta.map((item) =>
                    item.noteType === updatedNote.noteType && item.noteId === updatedNote.noteId
                        ? { ...item, title: updatedNote.title }
                        : item
                )
            );

            upsertNoteCache(updatedNote);
            // Only mirror into the legacy `currentTaskNote` when this
            // panel's note is the active one — protects against hidden
            // panels overwriting active state via socket-driven updates.
            if (
                useNM.currentTaskNote?.noteType === updatedNote.noteType &&
                useNM.currentTaskNote?.noteId === updatedNote.noteId
            ) {
                useNM.setCurrentTaskNote(updatedNote);
            }

            useNM.bumpNoteVersionsHead(updatedNote.noteType, updatedNote.noteId);
        },
    });

    useEffect(() => {
        if (isActive) setNoteBodySaved(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    if (accessDenied) {
        // The note exists but this user has no role on it (shared-URL
        // case) — offer the access-request flow instead of a blank pane.
        return (
            <Box sx={{ display: isActive ? "block" : "none", width: "100%", height: "100%" }}>
                <NoteAccessRequestPanel noteId={tab.noteId} noteType={2} socket={socket} />
            </Box>
        );
    }

    if (!note || !body) {
        return null;
    }

    return (
        <Box
            sx={{
                display: isActive ? "block" : "none",
                paddingX: "5px",
                paddingTop: "0px",
                paddingBottom: "5px",
                width: "100%",
                position: "relative",
            }}
        >
            <FormControl
                sx={{
                    mt: "10px",
                    ml: "10px",
                    justifyContent: "center",
                    position: "absolute",
                    zIndex: 100,
                    width: isMobile ? "50%" : "30%",
                }}
                required
            >
                <Input
                    placeholder={t.notes.editor.titlePlaceholder}
                    startDecorator={<NoteAltIcon />}
                    value={currentTaskNoteTitle}
                    variant="soft"
                    slotProps={{
                        input: {
                            ref: titleInputRef,
                            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    titleInputRef.current?.blur();
                                }
                            },
                        },
                    }}
                    sx={{
                        fontSize: "22px",
                        fontWeight: "bold",
                    }}
                    onBlur={handleTitleBlur}
                    onChange={(e) => handleTitleChange(e.target.value)}
                />
            </FormControl>
            {/* "Saved" chip lives INSIDE BnTaskNoteEditor (next to the
                wrap toggles) so it auto-shifts when the comments pane
                opens — see `noteBodySaved` prop below. */}
            <BnTaskNoteEditor
                body={body || []}
                currentNoteMembers={useNM.currentNoteMembers}
                currentTaskNote={note}
                myself={myself}
                noteBodySaved={noteBodySaved}
                resyncSignal={useNM.noteResyncNonce}
                setBody={setBody}
                setMyself={setMyself}
                setNoteBodyEdited={setNoteBodyEdited}
                setNoteBodySaved={setNoteBodySaved}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
            />
        </Box>
    );
};
