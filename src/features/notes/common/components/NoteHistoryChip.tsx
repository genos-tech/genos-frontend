import { useEffect, useState } from "react";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { Box, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, Messages, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ModalNoteHistory } from "./ModalNoteHistory";

interface NoteHistoryChipProps {
    useNM: NoteManagementState;
    noteType: number;
    noteId: number;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: any;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
}

// Format an ISO timestamp as a short relative string.
const relTime = (iso: string, t: Messages): string => {
    const ts = new Date(iso).getTime();
    if (!ts) return "";
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 45) return t.notes.history.relTime.justNow;
    if (sec < 90) return t.notes.history.relTime.oneMinShort;
    const min = Math.floor(sec / 60);
    if (min < 60) return fmt(t.notes.history.relTime.minutesShort, { n: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return fmt(t.notes.history.relTime.hoursShort, { n: hr });
    const day = Math.floor(hr / 24);
    if (day < 7) return fmt(t.notes.history.relTime.daysShort, { n: day });
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
};

export const NoteHistoryChip = ({
    useNM,
    noteType,
    noteId,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
}: NoteHistoryChipProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isMobile = useIsMobile();
    const { t } = useTranslation();

    // Periodic re-render so the relative time advances without waiting
    // for a new save.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
        return () => window.clearInterval(id);
    }, []);

    const [open, setOpen] = useState(false);

    const head = useNM.currentNoteVersions[0];
    if (!head || noteId <= 0) return null;
    // Hidden on mobile per design — the chip's "edited by X · 2m ago"
    // metadata is desktop chrome; the history modal is reachable from
    // the note's overflow menu when needed.
    if (isMobile) return null;

    const editorName = head.editor?.userName ?? t.notes.defaults.someone;
    const tsForChip = head.tsUpdatedAt || head.tsCreatedAt;
    const summary = fmt(t.notes.history.chipSummary, {
        name: editorName,
        time: relTime(tsForChip, t),
    });

    return (
        <>
            <Tooltip
                size="sm"
                title={t.notes.history.chipTooltip}
                variant="outlined"
                sx={{
                    background: isDark ? "rgba(20,16,28,0.95)" : "rgba(255,255,255,0.98)",
                    borderRadius: "8px",
                }}
            >
                <Box
                    component="button"
                    type="button"
                    aria-label={summary}
                    onClick={() => setOpen(true)}
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        height: 30,
                        px: 1.25,
                        borderRadius: "999px",
                        border: `1px solid ${
                            isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
                        }`,
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        color: isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.72)",
                        cursor: "pointer",
                        font: "inherit",
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                        "&:hover": {
                            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                            transform: "translateY(-1px)",
                        },
                        "&:focus-visible": {
                            outline: `2px solid ${
                                isDark ? "rgba(124,58,237,0.6)" : "rgba(124,58,237,0.5)"
                            }`,
                            outlineOffset: 2,
                        },
                    }}
                >
                    <HistoryRoundedIcon
                        sx={{
                            fontSize: 16,
                            color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                        }}
                    />
                    <Typography
                        level="body-xs"
                        sx={{
                            fontWeight: 500,
                            color: "inherit",
                            letterSpacing: "-0.005em",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {summary}
                    </Typography>
                </Box>
            </Tooltip>

            <ModalNoteHistory
                open={open}
                onClose={() => setOpen(false)}
                useNM={useNM}
                noteType={noteType}
                noteId={noteId}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useUISM={useUISM}
            />
        </>
    );
};
