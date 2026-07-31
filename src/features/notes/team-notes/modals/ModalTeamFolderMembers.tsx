import { useEffect, useMemo, useState } from "react";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { useMentionGroupsContext } from "../../../../context/MentionGroupsContext";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import {
    NoteFolderInviteGroup,
    TeamNoteFolderMemberProps,
    TeamNoteFolderTreeNode,
} from "../../../../types/notes";
import {
    grantTeamFolderMembers,
    loadTeamFolderMembers,
    revokeTeamFolderMember,
} from "../services/teamNoteFolderMembers";

const ROLE_OWNER = 1;
const ROLE_EDITOR = 2;
const ROLE_VIEWER = 3;

type Props = {
    open: boolean;
    folder: TeamNoteFolderTreeNode | null;
    myself: UserProps;
    useTEM: TeamManagementState;
    onClose: () => void;
    onChanged: () => void;
};

// Roster for one team folder, plus the invite affordance the whole
// feature exists for: adding a GROUP instead of clicking N names.
//
// A selected group is expanded CLIENT-side purely so the user can see
// who is about to be added before confirming — `listMentionGroups`
// already returns `memberUserIds` inline, so that preview costs no extra
// request. The group is still sent to the server, which re-expands it
// authoritatively; the client list is never the permission source.
export const ModalTeamFolderMembers = (props: Props) => {
    const { open, folder, myself, useTEM, onClose, onChanged } = props;
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const hostZIndex = useNoteModalHostZIndex();
    const { mentionGroups } = useMentionGroupsContext();

    const [members, setMembers] = useState<TeamNoteFolderMemberProps[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [pendingUserIds, setPendingUserIds] = useState<string[]>([]);
    const [pendingGroups, setPendingGroups] = useState<NoteFolderInviteGroup[]>([]);
    const [inviteRole, setInviteRole] = useState<number>(ROLE_EDITOR);

    const canManage = folder != null && folder.myRoleId < ROLE_VIEWER;

    const reload = async () => {
        if (!folder) return;
        setLoading(true);
        setMembers(await loadTeamFolderMembers(myself, folder.folderId, accessToken));
        setLoading(false);
    };

    useEffect(() => {
        if (!open || !folder) return;
        setSearch("");
        setPendingUserIds([]);
        setPendingGroups([]);
        setInviteRole(ROLE_EDITOR);
        void reload();
    }, [open, folder?.folderId]);

    const existingIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

    // Everyone the pending selection would add — individuals plus every
    // member of each pending group, minus people who already have access.
    const previewUserIds = useMemo(() => {
        const out = new Set(pendingUserIds);
        for (const g of pendingGroups) {
            if (g.type !== "mention_group") continue;
            const group = mentionGroups.find((mg) => String(mg.groupId) === g.id);
            group?.memberUserIds.forEach((uid) => out.add(String(uid)));
        }
        existingIds.forEach((id) => out.delete(id));
        return Array.from(out);
    }, [pendingUserIds, pendingGroups, mentionGroups, existingIds]);

    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (useTEM.teamMembers ?? []).filter((m) => {
            if (existingIds.has(m.userId) || pendingUserIds.includes(m.userId)) return false;
            if (!q) return false;
            return m.userName?.toLowerCase().includes(q) || m.userEmail?.toLowerCase().includes(q);
        });
    }, [search, useTEM.teamMembers, existingIds, pendingUserIds]);

    const availableGroups = useMemo(
        () => mentionGroups.filter((g) => !pendingGroups.some((p) => p.id === String(g.groupId))),
        [mentionGroups, pendingGroups]
    );

    const submit = async () => {
        if (!folder || (pendingUserIds.length === 0 && pendingGroups.length === 0)) return;
        setSaving(true);
        await grantTeamFolderMembers(
            myself,
            folder.folderId,
            { userIds: pendingUserIds, groups: pendingGroups, roleId: inviteRole },
            accessToken
        );
        setPendingUserIds([]);
        setPendingGroups([]);
        setSearch("");
        await reload();
        setSaving(false);
        onChanged();
    };

    const revoke = async (userId: string) => {
        if (!folder) return;
        setSaving(true);
        await revokeTeamFolderMember(myself, folder.folderId, userId, accessToken);
        await reload();
        setSaving(false);
        onChanged();
    };

    const groupLabel = (m: TeamNoteFolderMemberProps): string | null => {
        if (!m.viaGroupType || !m.viaGroupId) return null;
        if (m.viaGroupType === "mention_group") {
            const g = mentionGroups.find((mg) => String(mg.groupId) === m.viaGroupId);
            return g ? `@${g.groupName}` : null;
        }
        return m.viaGroupType;
    };

    return (
        <Modal open={open} sx={noteModalChildStackSx(hostZIndex)} onClose={onClose}>
            <ModalDialog sx={{ minWidth: 460, maxWidth: 560 }}>
                <Typography level="title-md">
                    {fmt(t.notes.teamNotes.membersTitle, { name: folder?.name ?? "" })}
                </Typography>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size="sm" />
                    </Box>
                ) : (
                    <Stack spacing={1} sx={{ mt: 1, maxHeight: 260, overflowY: "auto" }}>
                        {members.length === 0 && (
                            <Typography level="body-sm" sx={{ fontStyle: "italic", opacity: 0.7 }}>
                                {t.notes.teamNotes.noMembers}
                            </Typography>
                        )}
                        {members.map((m) => {
                            const via = groupLabel(m);
                            const isSelf = m.userId === myself.userId;
                            return (
                                <Box
                                    key={m.userId}
                                    sx={{ alignItems: "center", display: "flex", gap: 1 }}
                                >
                                    {/* No presence dot: a roster row is
                                        about access, not availability. */}
                                    <UserAvatar showPulseDot={false} size={26} userId={m.userId} />
                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                        <Typography level="body-sm" noWrap>
                                            {m.userName}
                                            {isSelf ? ` (${t.notes.sharing.you})` : ""}
                                        </Typography>
                                        {via && (
                                            <Typography level="body-xs" sx={{ opacity: 0.65 }}>
                                                {fmt(t.notes.teamNotes.invitedViaGroup, {
                                                    group: via,
                                                })}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Chip size="sm" variant="soft">
                                        {m.roleId === ROLE_OWNER
                                            ? t.notes.sharing.roles.owner
                                            : m.roleId === ROLE_EDITOR
                                              ? t.notes.sharing.roles.editor
                                              : t.notes.sharing.roles.viewer}
                                    </Chip>
                                    {canManage && m.roleId !== ROLE_OWNER && (
                                        <IconButton
                                            color="danger"
                                            disabled={saving}
                                            size="sm"
                                            title={t.notes.teamNotes.removeAccess}
                                            variant="plain"
                                            onClick={() => void revoke(m.userId)}
                                        >
                                            <PersonRemoveRoundedIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>
                )}

                {canManage && (
                    <>
                        <Divider sx={{ my: 1.5 }} />

                        <Typography level="title-sm">{t.notes.teamNotes.addGroup}</Typography>
                        <Typography level="body-xs" sx={{ mb: 0.5, opacity: 0.7 }}>
                            {t.notes.teamNotes.groupsHint}
                        </Typography>
                        <Select
                            placeholder={t.notes.teamNotes.addGroup}
                            size="sm"
                            startDecorator={<GroupRoundedIcon sx={{ fontSize: 16 }} />}
                            value={null}
                            onChange={(_, value) => {
                                if (!value) return;
                                setPendingGroups((prev) => [
                                    ...prev,
                                    { type: "mention_group", id: String(value) },
                                ]);
                            }}
                        >
                            {availableGroups.map((g) => (
                                <Option key={g.groupId} value={String(g.groupId)}>
                                    @{g.groupName} · {g.memberCount}
                                </Option>
                            ))}
                        </Select>

                        <Typography level="title-sm" sx={{ mt: 1.5 }}>
                            {t.notes.teamNotes.addPeople}
                        </Typography>
                        <Input
                            placeholder={t.notes.sharing.searchPlaceholder}
                            size="sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {candidates.length > 0 && (
                            <Stack
                                spacing={0.5}
                                sx={{ maxHeight: 130, mt: 0.5, overflowY: "auto" }}
                            >
                                {candidates.map((m) => (
                                    <Button
                                        key={m.userId}
                                        size="sm"
                                        sx={{ justifyContent: "flex-start" }}
                                        variant="plain"
                                        onClick={() => {
                                            setPendingUserIds((prev) => [...prev, m.userId]);
                                            setSearch("");
                                        }}
                                    >
                                        {m.userName}
                                    </Button>
                                ))}
                            </Stack>
                        )}

                        {/* What the pending selection actually resolves to,
                            so a group add is never a blind action. */}
                        {(pendingGroups.length > 0 || pendingUserIds.length > 0) && (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                                {pendingGroups.map((g) => {
                                    const grp = mentionGroups.find(
                                        (mg) => String(mg.groupId) === g.id
                                    );
                                    return (
                                        <Chip
                                            key={`g-${g.id}`}
                                            color="primary"
                                            size="sm"
                                            variant="soft"
                                            onClick={() =>
                                                setPendingGroups((prev) =>
                                                    prev.filter((p) => p.id !== g.id)
                                                )
                                            }
                                        >
                                            @{grp?.groupName ?? g.id} ✕
                                        </Chip>
                                    );
                                })}
                                {pendingUserIds.map((uid) => {
                                    const m = (useTEM.teamMembers ?? []).find(
                                        (x) => x.userId === uid
                                    );
                                    return (
                                        <Chip
                                            key={`u-${uid}`}
                                            size="sm"
                                            variant="soft"
                                            onClick={() =>
                                                setPendingUserIds((prev) =>
                                                    prev.filter((p) => p !== uid)
                                                )
                                            }
                                        >
                                            {m?.userName ?? uid} ✕
                                        </Chip>
                                    );
                                })}
                            </Box>
                        )}

                        <Box sx={{ alignItems: "center", display: "flex", gap: 1, mt: 1.5 }}>
                            <Select
                                size="sm"
                                sx={{ minWidth: 120 }}
                                value={inviteRole}
                                onChange={(_, v) => setInviteRole(Number(v) || ROLE_EDITOR)}
                            >
                                <Option value={ROLE_EDITOR}>{t.notes.sharing.roles.editor}</Option>
                                <Option value={ROLE_VIEWER}>{t.notes.sharing.roles.viewer}</Option>
                            </Select>
                            <Box sx={{ flexGrow: 1 }}>
                                {previewUserIds.length > 0 && (
                                    <Typography level="body-xs" sx={{ opacity: 0.75 }}>
                                        {fmt(t.notes.teamNotes.memberCount, {
                                            count: previewUserIds.length,
                                        })}
                                    </Typography>
                                )}
                            </Box>
                            <Button
                                disabled={
                                    saving ||
                                    (pendingUserIds.length === 0 && pendingGroups.length === 0)
                                }
                                loading={saving}
                                onClick={() => void submit()}
                            >
                                {t.notes.sharing.invite}
                            </Button>
                        </Box>
                    </>
                )}

                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.sharing.done}
                    </Button>
                </Box>
            </ModalDialog>
        </Modal>
    );
};
