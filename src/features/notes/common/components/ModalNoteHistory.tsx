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

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
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

const relTime = (iso: string): string => {
    const t = new Date(iso).getTime();
    if (!t) return "";
    const diff = Date.now() - t;
    const sec = Math.floor(diff / 1000);
    if (sec < 45) return "just now";
    if (sec < 90) return "1 minute ago";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minutes ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hours ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} days ago`;
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
        <Modal open={open} onClose={onClose}>
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
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ px: 2.5, py: 2 }}
                >
                    <Box>
                        <Typography level="title-md" sx={{ fontWeight: 700 }}>
                            Version history
                        </Typography>
                        <Typography
                            level="body-xs"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                                mt: 0.25,
                            }}
                        >
                            {canRestore
                                ? "Pick a version to preview it. Restore writes a new version so the history is preserved."
                                : "Read-only view — only the note's owner or editors can restore a past version."}
                        </Typography>
                    </Box>
                    <ModalClose variant="plain" sx={{ position: "static" }} />
                </Stack>

                <Divider sx={{ opacity: isDark ? 0.08 : 0.12 }} />

                {/* Body: split list / preview */}
                <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
                    {/* Left: list */}
                    <Box
                        sx={{
                            width: 320,
                            flexShrink: 0,
                            borderRight: `1px solid ${
                                isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
                            }`,
                            overflow: "auto",
                        }}
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    >
                        {versions.length === 0 ? (
                            <Typography
                                level="body-xs"
                                sx={{ p: 2, fontStyle: "italic", opacity: 0.6 }}
                            >
                                No history yet. Versions will appear here after the next save.
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
                                            onClick={() => setSelectedVersionNo(v.versionNo)}
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
                                        >
                                            <AvatarWithStatus
                                                avatarSize={32}
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
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                useCM={useCM}
                                                useUISM={useUISM}
                                            />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Stack
                                                    direction="row"
                                                    alignItems="center"
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
                                                        {v.editor?.userName ?? "Unknown"}
                                                    </Typography>
                                                    {isHead && (
                                                        <Chip
                                                            size="sm"
                                                            variant="soft"
                                                            color="primary"
                                                            sx={{ fontSize: 10 }}
                                                        >
                                                            current
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
                                                    {relTime(v.tsUpdatedAt)}
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
                                                        restored from v{v.restoredFromVersionNo}
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
                            overflow: "auto",
                            p: 2.5,
                        }}
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    >
                        {loadingDetail && (
                            <Stack alignItems="center" sx={{ pt: 6 }}>
                                <CircularProgress size="sm" />
                            </Stack>
                        )}
                        {!loadingDetail && !detail && (
                            <Typography level="body-sm" sx={{ fontStyle: "italic", opacity: 0.6 }}>
                                Select a version on the left to preview it.
                            </Typography>
                        )}
                        {!loadingDetail && detail && (
                            <Stack spacing={1.5}>
                                <Typography level="h4" sx={{ fontWeight: 700 }}>
                                    {detail.title || "Untitled"}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.5)"
                                            : "rgba(0,0,0,0.55)",
                                    }}
                                >
                                    Snapshot from {new Date(detail.tsUpdatedAt).toLocaleString()}
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
                                            (empty body)
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
                    direction="row"
                    alignItems="center"
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
                            ? "This is the current version."
                            : canRestore
                              ? "Restoring writes a new version on top of the live note."
                              : "You don't have permission to restore."}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button variant="plain" onClick={onClose}>
                            Close
                        </Button>
                        <Button
                            variant="solid"
                            color="primary"
                            startDecorator={<RestoreRoundedIcon sx={{ fontSize: 18 }} />}
                            disabled={!restoreEnabled}
                            loading={restoring}
                            onClick={handleRestore}
                        >
                            Restore this version
                        </Button>
                    </Stack>
                </Stack>
            </Sheet>
        </Modal>
    );
};
