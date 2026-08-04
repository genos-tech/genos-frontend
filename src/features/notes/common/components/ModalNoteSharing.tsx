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

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { NoteRoleMember } from "../../../../types/notes";
import { ownTeamOnly } from "../../../../utils/teamRoster";
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
    const hostZIndex = useNoteModalHostZIndex();

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
        // `ownTeamOnly`: a note is granted to people in your team. The other
        // teams' people in the roster are there to be recognized, and this
        // grant is not a thing the server would accept for them.
        return ownTeamOnly(teamMembers).filter((u) => {
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
        <Modal open={open} sx={noteModalChildStackSx(hostZIndex)} onClose={onClose}>
            <Sheet
                sx={{
                    width: { xs: "calc(100vw - 16px)", sm: 520 },
                    maxWidth: { xs: "100vw", sm: "calc(100vw - 32px)" },
                    // Mobile: clamp to viewport minus a small gutter +
                    // BottomTabBar height so the sheet never lives under
                    // the tab bar or off-screen.
                    maxHeight: {
                        xs: "calc(100dvh - 24px - var(--BottomTabBar-height, 60px))",
                        sm: "calc(100vh - 64px)",
                    },
                    mx: "auto",
                    // 10vh vertical margin works on desktop but
                    // pushes the sheet half off-screen on a 700-tall
                    // mobile viewport. Use a small fixed margin on xs.
                    my: { xs: "12px", sm: "10vh" },
                    p: { xs: 2, sm: 2.5 },
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
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Typography level="title-md" sx={{ fontWeight: 700 }}>
                        {fmt(t.notes.sharing.title, {
                            title: noteTitle || t.notes.defaults.untitled,
                        })}
                    </Typography>
                    <ModalClose sx={{ position: "static" }} variant="plain" />
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
                                        alignItems="center"
                                        direction="row"
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
                                            isYou={isSelf}
                                            myself={myself}
                                            setMyself={setMyself}
                                            showPulseDot={false}
                                            socket={socket}
                                            useCM={useCM}
                                            useUISM={useUISM}
                                            avatarUser={
                                                {
                                                    userId: m.userId,
                                                    userName: m.userName,
                                                    avatarImgPath: m.avatarUrl ?? "",
                                                } as UserProps
                                            }
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
                                                    sx={{ fontSize: 10, flexShrink: 0 }}
                                                    variant="soft"
                                                >
                                                    {t.notes.sharing.you}
                                                </Chip>
                                            )}
                                        </Box>
                                        <Select
                                            disabled={disableEdit}
                                            size="sm"
                                            sx={{ minWidth: 110 }}
                                            value={m.roleId}
                                            onChange={(_, v) => {
                                                if (v != null) handleRoleChange(m, v as number);
                                            }}
                                        >
                                            <Option
                                                disabled={isLastOwner || m.roleId !== ROLE_OWNER}
                                                value={ROLE_OWNER}
                                            >
                                                {ROLE_LABEL[ROLE_OWNER]}
                                            </Option>
                                            <Option
                                                disabled={isLastOwner && m.roleId === ROLE_OWNER}
                                                value={ROLE_EDITOR}
                                            >
                                                {ROLE_LABEL[ROLE_EDITOR]}
                                            </Option>
                                            <Option
                                                disabled={isLastOwner && m.roleId === ROLE_OWNER}
                                                value={ROLE_VIEWER}
                                            >
                                                {ROLE_LABEL[ROLE_VIEWER]}
                                            </Option>
                                        </Select>
                                        <IconButton
                                            color="danger"
                                            disabled={disableEdit || m.roleId === ROLE_OWNER}
                                            size="sm"
                                            title={t.notes.sharing.removeAccess}
                                            variant="plain"
                                            onClick={() => handleRevoke(m.userId)}
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
                            placeholder={t.notes.sharing.searchPlaceholder}
                            size="sm"
                            sx={{ mb: 1 }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
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
                                            alignItems="center"
                                            direction="row"
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
                                                showPulseDot={false}
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
                                                loading={savingUserId === u.userId}
                                                size="sm"
                                                variant="soft"
                                                startDecorator={
                                                    <PersonAddRoundedIcon sx={{ fontSize: 16 }} />
                                                }
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
