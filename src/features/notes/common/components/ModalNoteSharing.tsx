import { useMemo, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import {
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Input,
    Modal,
    ModalClose,
    Option,
    Select,
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { NoteRoleMember } from "../../../../types/notes";
import { getMyNoteRoleId, NOTE_ROLE_OWNER } from "../utils/noteRoles";

interface ModalNoteSharingProps {
    open: boolean;
    onClose: () => void;
    noteType: number;
    noteId: number;
    noteTitle: string;
    myself: UserProps;
    // Plumbed through to `AvatarWithStatus`. The shim no longer reads
    // these (they come from `AvatarContextProvider`), but the type still
    // requires them so we keep the prop surface explicit.
    setMyself: (me: UserProps) => void;
    socket: any;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    teamMembers: UserProps[];
    useNM: NoteManagementState;
}

const ROLE_OWNER = NOTE_ROLE_OWNER;
const ROLE_EDITOR = 2;
const ROLE_VIEWER = 3;

export const ModalNoteSharing = ({
    open,
    onClose,
    noteType,
    noteId,
    noteTitle,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
    teamMembers,
    useNM,
}: ModalNoteSharingProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const ROLE_LABEL: Record<number, string> = {
        1: t.notes.sharing.roles.owner,
        2: t.notes.sharing.roles.editor,
        3: t.notes.sharing.roles.viewer,
    };

    const [search, setSearch] = useState("");
    const [savingUserId, setSavingUserId] = useState<string | null>(null);

    const members = useNM.currentNoteMembers;
    const memberByUserId = useMemo(() => {
        const map = new Map<string, NoteRoleMember>();
        members.forEach((m) => map.set(String(m.userId), m));
        return map;
    }, [members]);

    const ownerCount = useMemo(
        () => members.filter((m) => m.roleId === ROLE_OWNER).length,
        [members]
    );

    const myRoleId = getMyNoteRoleId(members, myself.userId);
    const isOwner = myRoleId === ROLE_OWNER;

    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        return teamMembers.filter((u) => {
            if (String(u.userId) === String(myself.userId)) return false;
            if (memberByUserId.has(String(u.userId))) return false;
            if (!q) return true;
            return u.userName.toLowerCase().includes(q) || u.userEmail.toLowerCase().includes(q);
        });
    }, [teamMembers, search, memberByUserId, myself.userId]);

    const handleGrant = async (targetUserId: string, roleId: number) => {
        setSavingUserId(targetUserId);
        try {
            await useNM.grantNoteRole(noteType, noteId, targetUserId, roleId);
        } finally {
            setSavingUserId(null);
        }
    };

    const handleRevoke = async (targetUserId: string) => {
        setSavingUserId(targetUserId);
        try {
            await useNM.revokeNoteRole(noteType, noteId, targetUserId);
        } finally {
            setSavingUserId(null);
        }
    };

    const handleRoleChange = async (member: NoteRoleMember, newRoleId: number) => {
        if (newRoleId === member.roleId) return;
        await handleGrant(member.userId, newRoleId);
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Sheet
                sx={{
                    width: 520,
                    maxWidth: "calc(100vw - 32px)",
                    maxHeight: "calc(100vh - 64px)",
                    mx: "auto",
                    my: "10vh",
                    p: 2.5,
                    borderRadius: "12px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    background: isDark ? "rgba(20,16,28,0.98)" : "rgba(255,255,255,0.98)",
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Typography level="title-md" sx={{ fontWeight: 700 }}>
                        {fmt(t.notes.sharing.title, {
                            title: noteTitle || t.notes.defaults.untitled,
                        })}
                    </Typography>
                    <ModalClose variant="plain" sx={{ position: "static" }} />
                </Stack>

                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                        mb: 2,
                    }}
                >
                    {isOwner
                        ? t.notes.sharing.ownerDescription
                        : t.notes.sharing.viewerDescription}
                </Typography>

                {/* Current members */}
                <Box sx={{ overflow: "auto", flexShrink: 1, mb: 1 }}>
                    {members.length === 0 ? (
                        <Box sx={{ py: 1.5 }}>
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontStyle: "italic",
                                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                                }}
                            >
                                {t.notes.sharing.noAccessYet}
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={0.75}>
                            {members.map((m) => {
                                const isSelf = String(m.userId) === String(myself.userId);
                                const isLastOwner = m.roleId === ROLE_OWNER && ownerCount <= 1;
                                const disableEdit =
                                    !isOwner || isSelf || savingUserId === m.userId;
                                return (
                                    <Stack
                                        key={m.userId}
                                        direction="row"
                                        alignItems="center"
                                        spacing={1.25}
                                        sx={{
                                            px: 1,
                                            py: 0.75,
                                            borderRadius: "8px",
                                            border: `1px solid ${
                                                isDark
                                                    ? "rgba(255,255,255,0.06)"
                                                    : "rgba(0,0,0,0.06)"
                                            }`,
                                        }}
                                    >
                                        <AvatarWithStatus
                                            avatarSize={32}
                                            avatarUser={
                                                {
                                                    userId: m.userId,
                                                    userName: m.userName,
                                                    avatarImgPath: m.avatarUrl ?? "",
                                                } as UserProps
                                            }
                                            isYou={isSelf}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useCM={useCM}
                                            useUISM={useUISM}
                                        />
                                        <Box
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
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
                                                {m.userName}
                                            </Typography>
                                            {isSelf && (
                                                <Chip
                                                    size="sm"
                                                    variant="soft"
                                                    sx={{ fontSize: 10, flexShrink: 0 }}
                                                >
                                                    {t.notes.sharing.you}
                                                </Chip>
                                            )}
                                        </Box>
                                        <Select
                                            size="sm"
                                            value={m.roleId}
                                            disabled={disableEdit}
                                            onChange={(_, v) => {
                                                if (v != null) handleRoleChange(m, v as number);
                                            }}
                                            sx={{ minWidth: 110 }}
                                        >
                                            <Option
                                                value={ROLE_OWNER}
                                                disabled={isLastOwner || m.roleId !== ROLE_OWNER}
                                            >
                                                {ROLE_LABEL[ROLE_OWNER]}
                                            </Option>
                                            <Option
                                                value={ROLE_EDITOR}
                                                disabled={isLastOwner && m.roleId === ROLE_OWNER}
                                            >
                                                {ROLE_LABEL[ROLE_EDITOR]}
                                            </Option>
                                            <Option
                                                value={ROLE_VIEWER}
                                                disabled={isLastOwner && m.roleId === ROLE_OWNER}
                                            >
                                                {ROLE_LABEL[ROLE_VIEWER]}
                                            </Option>
                                        </Select>
                                        <IconButton
                                            size="sm"
                                            variant="plain"
                                            color="danger"
                                            disabled={disableEdit || m.roleId === ROLE_OWNER}
                                            onClick={() => handleRevoke(m.userId)}
                                            title={t.notes.sharing.removeAccess}
                                        >
                                            <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Stack>
                                );
                            })}
                        </Stack>
                    )}
                </Box>

                {isOwner && (
                    <>
                        <Divider sx={{ my: 1.5, opacity: isDark ? 0.08 : 0.12 }} />

                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                mb: 0.75,
                                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
                            }}
                        >
                            {t.notes.sharing.addTeammate}
                        </Typography>

                        <Input
                            size="sm"
                            placeholder={t.notes.sharing.searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            sx={{ mb: 1 }}
                        />

                        <Box sx={{ maxHeight: 220, overflow: "auto" }}>
                            {candidates.length === 0 ? (
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontStyle: "italic",
                                        color: isDark
                                            ? "rgba(255,255,255,0.4)"
                                            : "rgba(0,0,0,0.4)",
                                        py: 1,
                                    }}
                                >
                                    {search
                                        ? t.notes.sharing.noMatchingTeammates
                                        : t.notes.sharing.noMoreToAdd}
                                </Typography>
                            ) : (
                                <Stack spacing={0.5}>
                                    {candidates.map((u) => (
                                        <Stack
                                            key={u.userId}
                                            direction="row"
                                            alignItems="center"
                                            spacing={1.25}
                                            sx={{
                                                px: 1,
                                                py: 0.75,
                                                borderRadius: "8px",
                                                "&:hover": {
                                                    background: isDark
                                                        ? "rgba(255,255,255,0.04)"
                                                        : "rgba(0,0,0,0.03)",
                                                },
                                            }}
                                        >
                                            <AvatarWithStatus
                                                avatarSize={32}
                                                avatarUser={u}
                                                isYou={false}
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                useCM={useCM}
                                                useUISM={useUISM}
                                            />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography
                                                    level="body-sm"
                                                    sx={{
                                                        fontWeight: 600,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {u.userName}
                                                </Typography>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.4)"
                                                            : "rgba(0,0,0,0.45)",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {u.userEmail}
                                                </Typography>
                                            </Box>
                                            <Button
                                                size="sm"
                                                variant="soft"
                                                startDecorator={
                                                    <PersonAddRoundedIcon sx={{ fontSize: 16 }} />
                                                }
                                                loading={savingUserId === u.userId}
                                                onClick={() => handleGrant(u.userId, ROLE_VIEWER)}
                                            >
                                                {t.notes.sharing.invite}
                                            </Button>
                                        </Stack>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    </>
                )}

                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 1,
                        pt: 1.5,
                    }}
                >
                    <Button variant="plain" onClick={onClose}>
                        {t.notes.sharing.done}
                    </Button>
                </Box>
            </Sheet>
        </Modal>
    );
};
