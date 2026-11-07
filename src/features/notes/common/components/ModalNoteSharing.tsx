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
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
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
    const theme = useTheme();
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
        <ModalFrame
            clearBottomBar
            description={
                isOwner ? t.notes.sharing.ownerDescription : t.notes.sharing.viewerDescription
            }
            hostZIndex={hostZIndex}
            open={open}
            size="md"
            // Joy's modal layer on a page surface; a modal-hosted note lifts it (host + 2).
            zIndex={theme.zIndex.modal}
            title={fmt(t.notes.sharing.title, {
                title: noteTitle || t.notes.defaults.untitled,
            })}
            actions={
                <Button color="neutral" variant="plain" onClick={onClose}>
                    {t.notes.sharing.done}
                </Button>
            }
            onClose={onClose}
        >
            {/* Current members */}
            <Box sx={{ mb: 1 }}>
                {members.length === 0 ? (
                    <Box sx={{ py: 1.5 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontStyle: "italic",
                                color: g.text.tertiary,
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
                            const disableEdit = !isOwner || isSelf || savingUserId === m.userId;
                            return (
                                <Stack
                                    key={m.userId}
                                    alignItems="center"
                                    direction="row"
                                    spacing={1.25}
                                    sx={{
                                        px: 1,
                                        py: 0.75,
                                        borderRadius: g.radius.md,
                                        border: `1px solid ${g.border.subtle}`,
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
                                    <AppTooltip title={t.notes.sharing.removeAccess}>
                                        <IconButton
                                            color="danger"
                                            disabled={disableEdit || m.roleId === ROLE_OWNER}
                                            size="sm"
                                            variant="plain"
                                            onClick={() => handleRevoke(m.userId)}
                                        >
                                            <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </AppTooltip>
                                </Stack>
                            );
                        })}
                    </Stack>
                )}
            </Box>

            {isOwner && (
                <>
                    <Divider sx={{ my: 1.5 }} />

                    <Typography
                        level="body-xs"
                        sx={{
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            mb: 0.75,
                            color: g.text.secondary,
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
                                    color: g.text.tertiary,
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
                                            borderRadius: g.radius.md,
                                            "&:hover": {
                                                background: g.hover,
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
                                                    color: g.text.tertiary,
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
        </ModalFrame>
    );
};
