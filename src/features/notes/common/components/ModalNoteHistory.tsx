import { useEffect, useMemo, useState } from "react";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { Box, Button, Chip, CircularProgress, Divider, Stack, Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, Messages, useTranslation } from "../../../../i18n";
import { focusRing, g } from "../../../../theme/tokens";
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
    const theme = useTheme();
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
        <ModalFrame
            hostZIndex={hostZIndex}
            open={open}
            size="xl"
            actions={
                <>
                    <Typography
                        level="body-xs"
                        sx={{
                            color: g.text.tertiary,
                            marginInlineEnd: "auto",
                            alignSelf: "center",
                        }}
                    >
                        {isHeadSelected
                            ? t.notes.history.currentVersionFooter
                            : canRestore
                              ? t.notes.history.restoreCanFooter
                              : t.notes.history.restoreCannotFooter}
                    </Typography>
                    <Button color="neutral" variant="plain" onClick={onClose}>
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
                </>
            }
            description={
                canRestore ? t.notes.history.ownerDescription : t.notes.history.viewerDescription
            }
            flush
            headerDivider
            onClose={onClose}
            title={t.notes.history.title}
            // Joy's modal layer on a page surface; a modal-hosted note lifts it (host + 2).
            zIndex={theme.zIndex.modal}
        >
            {/* Body: split list / preview (stacked on a phone) */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{ height: "min(440px, calc(100dvh - 260px))", minHeight: 0 }}
            >
                {/* Left: list */}
                <Box
                    sx={{
                        width: { xs: "auto", sm: 320 },
                        maxHeight: { xs: "40%", sm: "none" },
                        flexShrink: 0,
                        borderInlineEnd: { sm: `1px solid ${g.border.subtle}` },
                        borderBlockEnd: { xs: `1px solid ${g.border.subtle}`, sm: "none" },
                        overflow: "auto",
                    }}
                >
                    {versions.length === 0 ? (
                        <Typography
                            level="body-xs"
                            sx={{ p: 2, fontStyle: "italic", color: g.text.tertiary }}
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
                                            borderRadius: g.radius.md,
                                            border: `1px solid ${isSelected ? g.accent.border : "transparent"}`,
                                            background: isSelected
                                                ? g.accent.subtle
                                                : "transparent",
                                            color: "inherit",
                                            cursor: "pointer",
                                            font: "inherit",
                                            textAlign: "start",
                                            width: "100%",
                                            transition: "background 0.15s ease",
                                            "&:hover": {
                                                background: isSelected ? g.accent.subtle : g.hover,
                                            },
                                            "&:focus-visible": focusRing,
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
                                                          avatarImgPath: v.editor.avatarUrl ?? "",
                                                      } as UserProps)
                                                    : ({
                                                          userId: "",
                                                          userName: "?",
                                                          avatarImgPath: "",
                                                      } as UserProps)
                                            }
                                            isYou={
                                                !!v.editor &&
                                                String(v.editor.userId) === String(myself.userId)
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
                                                sx={{ color: g.text.secondary }}
                                            >
                                                {relTime(v.tsUpdatedAt, t)}
                                            </Typography>
                                            {v.restoredFromVersionNo != null && (
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: g.text.tertiary,
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
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 0,
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
                        <Typography
                            level="body-sm"
                            sx={{ fontStyle: "italic", color: g.text.tertiary }}
                        >
                            {t.notes.history.selectVersionPrompt}
                        </Typography>
                    )}
                    {!loadingDetail && detail && (
                        <Stack spacing={1.5}>
                            <Typography level="h4" sx={{ fontWeight: 600 }}>
                                {detail.title || t.notes.defaults.untitled}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                {fmt(t.notes.history.snapshotFrom, {
                                    time: new Date(detail.tsUpdatedAt).toLocaleString(),
                                })}
                            </Typography>
                            <Divider />
                            <Typography
                                component="div"
                                level="body-sm"
                                sx={{
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.6,
                                    color: g.text.primary,
                                }}
                            >
                                {previewText || (
                                    <Box
                                        component="span"
                                        sx={{ fontStyle: "italic", color: g.text.tertiary }}
                                    >
                                        {t.notes.history.emptyBody}
                                    </Box>
                                )}
                            </Typography>
                        </Stack>
                    )}
                </Box>
            </Stack>
        </ModalFrame>
    );
};
