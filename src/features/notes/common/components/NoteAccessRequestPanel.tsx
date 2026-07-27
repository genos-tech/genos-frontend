import { useState } from "react";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import SendIcon from "@mui/icons-material/Send";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Alert, Box, Button, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useTranslation } from "../../../../i18n";

type NoteAccessRequestPanelProps = {
    // 1 = personal, 2 = task, 3 = chat — the note_role int codes.
    noteType: number;
    noteId: number;
    socket: Socket | null;
};

// Rendered in place of the note editor when the single-note endpoint
// answers 403: the note EXISTS but the viewer has no role on it (the
// shared-URL case). One click files an access request that lands in the
// note owner's inbox (item_type=4) — the same steps as the
// private-project / private-GM join requests (ModalJoinProject /
// ModalJoinGM), inlined here because there's no click to intercept:
// the user is already ON the note URL.
//
// The emit carries only {note_type, note_id}; the server resolves the
// note title and owner (a role-less requester can't read either).
export const NoteAccessRequestPanel = ({
    noteType,
    noteId,
    socket,
}: NoteAccessRequestPanelProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const [sent, setSent] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSend = () => {
        if (!socket) {
            setErrorMessage(t.notes.accessRequest.socketNotFound);
            return;
        }
        setErrorMessage(null);
        socket.emit("note_access_request", { note_type: noteType, note_id: noteId });
        // Fire-and-forget like the join-request modals: a server-side
        // failure comes back on the "request_error" channel; the common
        // case is success, and a duplicate request dedupes server-side.
        setSent(true);
    };

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                minHeight: 320,
                p: 2,
            }}
        >
            <Box
                sx={{
                    textAlign: "center",
                    maxWidth: 420,
                    p: 4,
                    borderRadius: "16px",
                    border: "1px solid",
                    borderColor: isDark
                        ? "rgba(var(--gp-brand-500-rgb), 0.2)"
                        : "rgba(var(--gp-brand-700-rgb), 0.15)",
                    background: isDark
                        ? "linear-gradient(145deg, rgba(30,30,40,0.95) 0%, rgba(20,20,28,0.98) 100%)"
                        : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(250,248,255,1) 100%)",
                    boxShadow: isDark
                        ? "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(var(--gp-brand-500-rgb), 0.1)"
                        : "0 25px 50px -12px rgba(15,15,30,0.15)",
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
                        background: isDark
                            ? "linear-gradient(135deg, rgba(var(--gp-brand-500-rgb), 0.15) 0%, rgba(var(--gp-brandalt-500-rgb), 0.15) 100%)"
                            : "linear-gradient(135deg, rgba(var(--gp-brand-500-rgb), 0.12) 0%, rgba(var(--gp-brand-700-rgb), 0.12) 100%)",
                        border: "1px solid",
                        borderColor: isDark
                            ? "rgba(var(--gp-brand-500-rgb), 0.25)"
                            : "rgba(var(--gp-brand-700-rgb), 0.2)",
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    {sent ? (
                        <MarkEmailReadRoundedIcon
                            sx={{
                                color: isDark
                                    ? "rgba(var(--gp-brand-500-rgb), 0.9)"
                                    : "var(--gp-brand-700)",
                                fontSize: 28,
                            }}
                        />
                    ) : (
                        <StickyNote2RoundedIcon
                            sx={{
                                color: isDark
                                    ? "rgba(var(--gp-brand-500-rgb), 0.9)"
                                    : "var(--gp-brand-700)",
                                fontSize: 28,
                            }}
                        />
                    )}
                </Box>

                {/* Privacy badge */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        mb: 1,
                    }}
                >
                    <LockOutlineIcon
                        sx={{
                            color: isDark
                                ? "rgba(var(--gp-brand-500-rgb), 0.7)"
                                : "rgba(var(--gp-brand-700-rgb), 0.7)",
                            fontSize: 16,
                        }}
                    />
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark
                                ? "rgba(var(--gp-brand-500-rgb), 0.8)"
                                : "rgba(var(--gp-brand-700-rgb), 0.8)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                        }}
                    >
                        {t.notes.accessRequest.privateBadge}
                    </Typography>
                </Box>

                {/* Heading + body */}
                <Typography
                    level="h4"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.9)" : undefined,
                        fontWeight: 600,
                        mb: 1,
                    }}
                >
                    {sent ? t.notes.accessRequest.sentTitle : t.notes.accessRequest.heading}
                </Typography>
                <Typography
                    level="body-sm"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                        mb: 2.5,
                    }}
                >
                    {sent ? t.notes.accessRequest.sentBody : t.notes.accessRequest.body}
                </Typography>

                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            textAlign: "left",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {!sent && (
                    <Button
                        endDecorator={<SendIcon sx={{ fontSize: 16 }} />}
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-brand-500) 0%, var(--gp-brandalt-500) 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(var(--gp-brand-500-rgb), 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(var(--gp-brand-500-rgb), 0.4)",
                            },
                        }}
                        onClick={handleSend}
                    >
                        {t.notes.accessRequest.sendButton}
                    </Button>
                )}
            </Box>
        </Box>
    );
};
