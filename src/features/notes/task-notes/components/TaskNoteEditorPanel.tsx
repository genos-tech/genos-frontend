import { useEffect, useRef } from "react";
import CheckIcon from "@mui/icons-material/Check";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, Chip, FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnTaskNoteEditor } from "../../../../components/editors/bnTaskNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { upsertNoteCache, useNoteData } from "../../../../hooks/notes/useNoteData";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
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
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    const { note } = useNoteData<TaskNoteProps>(tab, { myself, accessToken });

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
                    width: "400px",
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
            {noteBodySaved && (
                <Box
                    sx={{
                        position: "absolute",
                        top: "52.5px",
                        right: "9%",
                        transform: "translateX(-50%)",
                        zIndex: 100,
                    }}
                >
                    <Chip
                        color="neutral"
                        size="sm"
                        startDecorator={<CheckIcon sx={{ fontSize: 14 }} />}
                        variant="soft"
                        sx={{
                            fontWeight: 500,
                            fontSize: "13px",
                            "--Chip-paddingInline": "10px",
                            animation: "fadeIn 0.3s ease-in-out",
                            "@keyframes fadeIn": {
                                from: { opacity: 0, transform: "scale(0.95)" },
                                to: { opacity: 1, transform: "scale(1)" },
                            },
                        }}
                    >
                        {t.notes.editor.savedChip}
                    </Chip>
                </Box>
            )}
            <BnTaskNoteEditor
                body={body || []}
                currentNoteMembers={useNM.currentNoteMembers}
                currentTaskNote={note}
                myself={myself}
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
