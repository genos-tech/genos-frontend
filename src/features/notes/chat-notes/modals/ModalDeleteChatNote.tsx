import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import NoteIcon from "@mui/icons-material/Note";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { NoteService } from "../../../../db/services/note.service";
import { DatabaseUtils } from "../../../../db/utils/database";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { deleteChatNote } from "../services/deleteChatNote";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const shake = keyframes`
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-5deg); }
    75% { transform: rotate(5deg); }
`;

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
    useNM: NoteManagementState;
};

export const ModalDeleteChatNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    handleCloseTab,
    useNM,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const noteService = new NoteService();

    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = useNM.chatNoteMeta.filter(
            (note) => note.parentNoteId === useNM.currentChatNote?.noteId
        );

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false && useNM.currentChatNote?.noteId) {
            // Delete from backend
            await deleteChatNote(myself, useNM.currentChatNote?.noteId, accessToken);
            // Delete from indexedDB
            await noteService.deleteChatNote(useNM.currentChatNote?.noteId);
            // Drop the per-document Yjs IndexedDB (`chat-note:<id>`) — y-indexeddb
            // creates one DB per editor document and never cleans up on its own.
            if (useNM.currentChatNote?.noteId !== undefined) {
                await DatabaseUtils.deleteYjsDatabase(`chat-note:${useNM.currentChatNote.noteId}`);
            }
            // Delete the deleted noteId from the meta object
            useNM.setChatNoteMeta(
                useNM.chatNoteMeta.filter((note) => note.noteId !== useNM.currentChatNote?.noteId)
            );
            handleCloseTab(useNM.selectedTabIndex, useNM.currentChatNote?.noteId);
            setOpenDeleteNote(false);
            setErrorMessage(null);
        } else {
            setErrorMessage(t.notes.deleteModal.childExistsError);
        }
    };

    return (
        <Modal
            open={openDeleteNote}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={() => {
                setOpenDeleteNote(false);
                setErrorMessage(null);
            }}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(232,121,195,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(232,121,195,0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "360px" },
                    maxWidth: "100vw",
                    p: { xs: 2, md: 3 },
                    textAlign: "center",
                }}
            >
                {/* Icon */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        borderRadius: "14px",
                        background:
                            "linear-gradient(135deg, rgba(232,121,195,0.15) 0%, rgba(192,38,168,0.15) 100%)",
                        border: "1px solid rgba(232,121,195,0.25)",
                        mx: "auto",
                        mb: 2,
                        "&:hover": {
                            animation: `${shake} 0.4s ease-in-out`,
                        },
                    }}
                >
                    <NoteIcon sx={{ color: "rgba(232,121,195,0.9)", fontSize: 28 }} />
                </Box>

                {/* Title */}
                <Typography
                    level="h4"
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        mb: 1,
                    }}
                >
                    {t.notes.deleteModal.title}
                </Typography>

                {/* Note Name */}
                <Typography
                    level="title-md"
                    sx={{
                        background: "linear-gradient(135deg, #e879c3 0%, #c026a8 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 600,
                        mb: 0.5,
                        px: 2,
                    }}
                >
                    {useNM.currentChatNote?.title}
                </Typography>

                {/* Warning */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2.5,
                    }}
                >
                    {t.notes.deleteModal.warning}
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        startDecorator={<WarningAmberIcon />}
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
                            textAlign: "left",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
                    <Button
                        variant="plain"
                        onClick={() => {
                            setOpenDeleteNote(false);
                            setErrorMessage(null);
                        }}
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 3,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                    >
                        {t.notes.deleteModal.cancel}
                    </Button>
                    <Button
                        onClick={handleDeleteNote}
                        sx={{
                            background: "linear-gradient(135deg, #c026a8 0%, #9d2386 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(232,121,195,0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(232,121,195,0.4)",
                            },
                        }}
                    >
                        {t.notes.deleteModal.confirm}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
