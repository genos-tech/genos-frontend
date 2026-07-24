import { useEffect, useMemo, useState } from "react";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Modal,
    ModalClose,
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, Messages, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { NoteVersionDetail } from "../../../../types/notes";
import { loadNoteVersion } from "../services/loadNoteVersion";

interface ModalNoteHistoryProps {
    open: boolean;
    onClose: () => void;
    useNM: NoteManagementState;
    noteType: number;
    noteId: number;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: any;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
}

const relTime = (iso: string, t: Messages): string => {
    const ts = new Date(iso).getTime();
    if (!ts) return "";
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 45) return t.notes.history.relTime.justNow;
    if (sec < 90) return t.notes.history.relTime.oneMinute;
    const min = Math.floor(sec / 60);
    if (min < 60) return fmt(t.notes.history.relTime.minutes, { n: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return fmt(t.notes.history.relTime.hours, { n: hr });
    const day = Math.floor(hr / 24);
    if (day < 7) return fmt(t.notes.history.relTime.days, { n: day });
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    });
};

// Walk a BlockNote document and pull plain text out. Used for the
// modal preview — we don't render the rich editor here, just enough
// content so the user can identify what they're about to restore.
const extractPlainText = (body: any): string => {
    if (!Array.isArray(body)) return "";
    const lines: string[] = [];
    const visit = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        const content = node.content;
        if (typeof content === "string") {
            lines.push(content);
        } else if (Array.isArray(content)) {
            content.forEach((c) => {
                if (typeof c === "string") lines.push(c);
                else if (c && typeof c.text === "string") lines.push(c.text);
            });
        }
        if (Array.isArray(node.children)) {
            node.children.forEach(visit);
        }
    };
    visit(body);
    return lines.filter((l) => l.trim().length > 0).join("\n");
};

const ROLE_OWNER = 1;
const ROLE_EDITOR = 2;

export const ModalNoteHistory = ({
    open,
    onClose,
    useNM,
    noteType,
    noteId,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
}: ModalNoteHistoryProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();

    const versions = useNM.currentNoteVersions;
    const headVersionNo = versions[0]?.versionNo ?? null;

    const myRoleId =
        useNM.currentNoteMembers.find((m) => String(m.userId) === String(myself.userId))?.roleId ??
        null;
    const canRestore = myRoleId === ROLE_OWNER || myRoleId === ROLE_EDITOR;

    const [selectedVersionNo, setSelectedVersionNo] = useState<number | null>(null);
    const [detail, setDetail] = useState<NoteVersionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [restoring, setRestoring] = useState(false);

    // Default the selection to the latest non-head version (or the head
    // if the note only has one version) whenever the list refreshes or
    // the modal re-opens.
    useEffect(() => {
        if (!open) return;
        if (versions.length === 0) {
            setSelectedVersionNo(null);
            setDetail(null);
            return;
        }
        const defaultPick = versions[1]?.versionNo ?? versions[0].versionNo;
        setSelectedVersionNo(defaultPick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, versions.length]);

    // Fetch the body whenever the selection changes.
    useEffect(() => {
        if (!open || selectedVersionNo == null) return;
        let cancelled = false;
        setLoadingDetail(true);
        setDetail(null);
        loadNoteVersion(myself, noteType, noteId, selectedVersionNo, accessToken)
            .then((d) => {
                if (!cancelled) setDetail(d ?? null);
            })
            .finally(() => {
                if (!cancelled) setLoadingDetail(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, selectedVersionNo, noteType, noteId]);

    const previewText = useMemo(() => extractPlainText(detail?.body), [detail]);

    const isHeadSelected = selectedVersionNo != null && selectedVersionNo === headVersionNo;
    const restoreEnabled =
        canRestore && !isHeadSelected && selectedVersionNo != null && !restoring && !loadingDetail;

    const handleRestore = async () => {
        if (selectedVersionNo == null) return;
        setRestoring(true);
        try {
            const ok = await useNM.restoreNoteVersion(noteType, noteId, selectedVersionNo);
            if (ok) onClose();
        } finally {
            setRestoring(false);
        }
    };

    return (
        <Modal open={open} sx={noteModalChildStackSx(hostZIndex)} onClose={onClose}>
            <Sheet
                sx={{
                    width: 880,
                    maxWidth: "calc(100vw - 32px)",
                    height: 580,
                    maxHeight: "calc(100vh - 64px)",
                    mx: "auto",
                    my: "8vh",
                    p: 0,
                    borderRadius: "12px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    background: isDark ? "rgba(20,16,28,0.98)" : "rgba(255,255,255,0.98)",
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                }}
            >
                {/* Header */}
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    sx={{ px: 2.5, py: 2 }}
                >
                    <Box>
                        <Typography level="title-md" sx={{ fontWeight: 700 }}>
                            {t.notes.history.title}
                        </Typography>
                        <Typography
                            level="body-xs"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                                mt: 0.25,
                            }}
                        >
                            {canRestore
                                ? t.notes.history.ownerDescription
                                : t.notes.history.viewerDescription}
                        </Typography>
                    </Box>
                    <ModalClose sx={{ position: "static" }} variant="plain" />
                </Stack>

                <Divider sx={{ opacity: isDark ? 0.08 : 0.12 }} />

                {/* Body: split list / preview */}
                <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
                    {/* Left: list */}
                    <Box
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                        sx={{
                            width: 320,
                            flexShrink: 0,
                            borderRight: `1px solid ${
                                isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
                            }`,
                            overflow: "auto",
                        }}
                    >
                        {versions.length === 0 ? (
                            <Typography
                                level="body-xs"
                                sx={{ p: 2, fontStyle: "italic", opacity: 0.6 }}
                            >
                                {t.notes.history.emptyList}
                            </Typography>
                        ) : (
                            <Stack spacing={0} sx={{ p: 1 }}>
                                {versions.map((v) => {
                                    const isSelected = v.versionNo === selectedVersionNo;
                                    const isHead = v.versionNo === headVersionNo;
                                    return (
                                        <Box
                                            key={v.versionNo}
                                            component="button"
                                            type="button"
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1.25,
                                                px: 1.25,
                                                py: 1,
                                                borderRadius: "8px",
                                                border: `1px solid ${
                                                    isSelected
                                                        ? isDark
                                                            ? "rgba(124,58,237,0.4)"
                                                            : "rgba(124,58,237,0.3)"
                                                        : "transparent"
                                                }`,
                                                background: isSelected
                                                    ? isDark
                                                        ? "rgba(124,58,237,0.12)"
                                                        : "rgba(124,58,237,0.08)"
                                                    : "transparent",
                                                color: "inherit",
                                                cursor: "pointer",
                                                font: "inherit",
                                                textAlign: "left",
                                                width: "100%",
                                                transition: "background 0.15s ease",
                                                "&:hover": {
                                                    background: isSelected
                                                        ? isDark
                                                            ? "rgba(124,58,237,0.16)"
                                                            : "rgba(124,58,237,0.1)"
                                                        : isDark
                                                          ? "rgba(255,255,255,0.04)"
                                                          : "rgba(0,0,0,0.03)",
                                                },
                                            }}
                                            onClick={() => setSelectedVersionNo(v.versionNo)}
                                        >
                                            <AvatarWithStatus
                                                avatarSize={32}
                                                myself={myself}
                                                setMyself={setMyself}
                                                showPulseDot={false}
                                                socket={socket}
                                                useCM={useCM}
                                                useUISM={useUISM}
                                                avatarUser={
                                                    v.editor
                                                        ? ({
                                                              userId: v.editor.userId,
                                                              userName: v.editor.userName,
                                                              avatarImgPath:
                                                                  v.editor.avatarUrl ?? "",
                                                          } as UserProps)
                                                        : ({
                                                              userId: "",
                                                              userName: "?",
                                                              avatarImgPath: "",
                                                          } as UserProps)
                                                }
                                                isYou={
                                                    !!v.editor &&
                                                    String(v.editor.userId) ===
                                                        String(myself.userId)
                                                }
                                            />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={0.75}
                                                    sx={{ minWidth: 0 }}
                                                >
                                                    <Typography
                                                        level="body-sm"
                                                        sx={{
                                                            fontWeight: 600,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        v{v.versionNo} ·{" "}
                                                        {v.editor?.userName ??
                                                            t.notes.history.unknownEditor}
                                                    </Typography>
                                                    {isHead && (
                                                        <Chip
                                                            color="primary"
                                                            size="sm"
                                                            sx={{ fontSize: 10 }}
                                                            variant="soft"
                                                        >
                                                            {t.notes.history.currentChip}
                                                        </Chip>
                                                    )}
                                                </Stack>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.5)"
                                                            : "rgba(0,0,0,0.55)",
                                                    }}
                                                >
                                                    {relTime(v.tsUpdatedAt, t)}
                                                </Typography>
                                                {v.restoredFromVersionNo != null && (
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            color: isDark
                                                                ? "rgba(255,255,255,0.4)"
                                                                : "rgba(0,0,0,0.45)",
                                                            fontStyle: "italic",
                                                        }}
                                                    >
                                                        {fmt(t.notes.history.restoredFrom, {
                                                            version: v.restoredFromVersionNo,
                                                        })}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </Box>

                    {/* Right: preview */}
                    <Box
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "auto",
                            p: 2.5,
                        }}
                    >
                        {loadingDetail && (
                            <Stack alignItems="center" sx={{ pt: 6 }}>
                                <CircularProgress size="sm" />
                            </Stack>
                        )}
                        {!loadingDetail && !detail && (
                            <Typography level="body-sm" sx={{ fontStyle: "italic", opacity: 0.6 }}>
                                {t.notes.history.selectVersionPrompt}
                            </Typography>
                        )}
                        {!loadingDetail && detail && (
                            <Stack spacing={1.5}>
                                <Typography level="h4" sx={{ fontWeight: 700 }}>
                                    {detail.title || t.notes.defaults.untitled}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.5)"
                                            : "rgba(0,0,0,0.55)",
                                    }}
                                >
                                    {fmt(t.notes.history.snapshotFrom, {
                                        time: new Date(detail.tsUpdatedAt).toLocaleString(),
                                    })}
                                </Typography>
                                <Divider sx={{ opacity: isDark ? 0.08 : 0.12 }} />
                                <Typography
                                    component="div"
                                    level="body-sm"
                                    sx={{
                                        whiteSpace: "pre-wrap",
                                        lineHeight: 1.6,
                                        color: isDark
                                            ? "rgba(255,255,255,0.82)"
                                            : "rgba(0,0,0,0.78)",
                                    }}
                                >
                                    {previewText || (
                                        <Box
                                            component="span"
                                            sx={{ fontStyle: "italic", opacity: 0.5 }}
                                        >
                                            {t.notes.history.emptyBody}
                                        </Box>
                                    )}
                                </Typography>
                            </Stack>
                        )}
                    </Box>
                </Stack>

                <Divider sx={{ opacity: isDark ? 0.08 : 0.12 }} />

                {/* Footer */}
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    sx={{ px: 2.5, py: 1.75 }}
                >
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.5)",
                        }}
                    >
                        {isHeadSelected
                            ? t.notes.history.currentVersionFooter
                            : canRestore
                              ? t.notes.history.restoreCanFooter
                              : t.notes.history.restoreCannotFooter}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button variant="plain" onClick={onClose}>
                            {t.notes.history.closeButton}
                        </Button>
                        <Button
                            color="primary"
                            disabled={!restoreEnabled}
                            loading={restoring}
                            startDecorator={<RestoreRoundedIcon sx={{ fontSize: 18 }} />}
                            variant="solid"
                            onClick={handleRestore}
                        >
                            {t.notes.history.restoreButton}
                        </Button>
                    </Stack>
                </Stack>
            </Sheet>
        </Modal>
    );
};
