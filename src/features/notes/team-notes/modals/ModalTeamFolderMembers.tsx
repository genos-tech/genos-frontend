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
import type { Socket } from "socket.io-client";

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { useMentionGroupsContext } from "../../../../context/MentionGroupsContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import {
    NoteFolderInviteGroup,
    TeamNoteFolderMemberProps,
    TeamNoteFolderTreeNode,
} from "../../../../types/notes";
import { canManageMembers, resolveMyRole } from "../../../../utils/memberRoles";
import { ownTeamOnly } from "../../../../utils/teamRoster";
import { ObjectSharesSection } from "../../../admin/components/team/ObjectSharesSection";
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
    // Source of the project and GM invite options — both are "a set of
    // people" the user already maintains elsewhere.
    useCM: ChatManagementState;
    /** Only to hand a new cross-team offer to the other team's inbox live. */
    socket: Socket | null;
    onClose: () => void;
    onChanged: () => void;
};

// One selectable group, flattened across the three kinds so the picker
// is a single list rather than three. `memberUserIds` is present only
// for mention groups, whose roster arrives inline with the group list;
// project and GM rosters are resolved server-side at invite time, so
// their preview count is unknown until then.
type GroupOption = {
    key: string;
    type: NoteFolderInviteGroup["type"];
    id: string;
    label: string;
    memberUserIds: string[] | null;
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
    const { open, folder, myself, useTEM, useCM, socket, onClose, onChanged } = props;
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

    // An external participant can hold EDITOR on a shared folder — that is
    // the point, they write notes in it — but the folder's roster belongs to
    // the owning team. The server refuses their invites and removals
    // outright, so the controls are hidden rather than shown and rejected.
    // Their own way in and out is the cross-team section below, where their
    // team's managers admit their colleagues.
    //
    // Two ways to be looking at someone else's folder: switched into the
    // host team's shell (`isGuest`), or — since shared folders started
    // appearing in your own Team Notes — the folder itself being theirs.
    const isExternalFolder = folder?.isExternal === true;
    const canManage =
        folder != null &&
        folder.myRoleId < ROLE_VIEWER &&
        !useTEM.currentTeam.isGuest &&
        !isExternalFolder;

    // Lending the folder to another organization is a TEAM decision, not a
    // folder one: an editor of this folder who is only a viewer of the team
    // may staff it, but must not hand the team's data outside. The server
    // enforces the same rule — this just decides whether to offer it.
    const canManageTeam = canManageMembers(
        resolveMyRole(myself.userId, useTEM.currentTeam.teamOwnerId, useTEM.teamMembers)
    );

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

    // The three group kinds the backend can expand, flattened into one
    // picker. Projects come from their PM channel (one per project) and
    // GMs from the channel list — both are already loaded, so offering
    // them costs no extra request.
    const groupOptions = useMemo<GroupOption[]>(() => {
        const out: GroupOption[] = mentionGroups.map((g) => ({
            key: `mention_group:${g.groupId}`,
            type: "mention_group",
            id: String(g.groupId),
            label: `@${g.groupName}`,
            memberUserIds: g.memberUserIds.map(String),
        }));
        for (const chat of useCM.allChats ?? []) {
            if (chat.chatType === 3 && chat.project?.projectId != null) {
                out.push({
                    key: `project:${chat.project.projectId}`,
                    type: "project",
                    id: String(chat.project.projectId),
                    label: chat.chatName,
                    memberUserIds: null,
                });
            } else if (chat.chatType === 2) {
                out.push({
                    key: `gm:${chat.chatId}`,
                    type: "gm",
                    id: String(chat.chatId),
                    label: chat.chatName,
                    memberUserIds: null,
                });
            }
        }
        return out;
    }, [mentionGroups, useCM.allChats]);

    // Everyone the pending selection would add — individuals plus every
    // KNOWN member of each pending group, minus people who already have
    // access. Project/GM rosters aren't known client-side, so the count
    // is a lower bound; the label says so.
    const previewUserIds = useMemo(() => {
        const out = new Set(pendingUserIds);
        for (const g of pendingGroups) {
            const opt = groupOptions.find((o) => o.type === g.type && o.id === g.id);
            opt?.memberUserIds?.forEach((uid) => out.add(uid));
        }
        existingIds.forEach((id) => out.delete(id));
        return Array.from(out);
    }, [pendingUserIds, pendingGroups, groupOptions, existingIds]);

    const previewIsExact = useMemo(
        () =>
            pendingGroups.every((g) => {
                const opt = groupOptions.find((o) => o.type === g.type && o.id === g.id);
                return opt?.memberUserIds != null;
            }),
        [pendingGroups, groupOptions]
    );

    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        // `ownTeamOnly`: folder permissions are a team-internal ACL. Another
        // team reaches this folder through a share, and their side decides
        // who among them is in it.
        return ownTeamOnly(useTEM.teamMembers ?? []).filter((m) => {
            if (existingIds.has(m.userId) || pendingUserIds.includes(m.userId)) return false;
            if (!q) return false;
            return m.userName?.toLowerCase().includes(q) || m.userEmail?.toLowerCase().includes(q);
        });
    }, [search, useTEM.teamMembers, existingIds, pendingUserIds]);

    const availableGroups = useMemo(
        () =>
            groupOptions.filter(
                (o) => !pendingGroups.some((p) => p.type === o.type && p.id === o.id)
            ),
        [groupOptions, pendingGroups]
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

    // Resolve a grant's recorded provenance back to a readable name.
    // Falls back to the raw kind when the group has since been deleted —
    // the grant itself is a snapshot and outlives its source.
    const groupLabel = (m: TeamNoteFolderMemberProps): string | null => {
        if (!m.viaGroupType || !m.viaGroupId) return null;
        const opt = groupOptions.find((o) => o.type === m.viaGroupType && o.id === m.viaGroupId);
        return opt?.label ?? m.viaGroupType;
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
                                        <AppTooltip title={t.notes.teamNotes.removeAccess}>
                                            <IconButton
                                                color="danger"
                                                disabled={saving}
                                                size="sm"
                                                variant="plain"
                                                onClick={() => void revoke(m.userId)}
                                            >
                                                <PersonRemoveRoundedIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </AppTooltip>
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
                                const opt = availableGroups.find((o) => o.key === value);
                                if (!opt) return;
                                setPendingGroups((prev) => [
                                    ...prev,
                                    { type: opt.type, id: opt.id },
                                ]);
                            }}
                        >
                            {availableGroups.map((g) => (
                                <Option key={g.key} value={g.key}>
                                    {g.label}
                                    {g.memberUserIds
                                        ? ` · ${g.memberUserIds.length}`
                                        : ` · ${
                                              g.type === "project"
                                                  ? t.notes.teamNotes.sourceProject
                                                  : t.notes.teamNotes.sourceGm
                                          }`}
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
                                    const opt = groupOptions.find(
                                        (o) => o.type === g.type && o.id === g.id
                                    );
                                    return (
                                        <Chip
                                            key={`g-${g.type}-${g.id}`}
                                            color="primary"
                                            size="sm"
                                            variant="soft"
                                            onClick={() =>
                                                setPendingGroups((prev) =>
                                                    prev.filter(
                                                        (p) =>
                                                            !(p.type === g.type && p.id === g.id)
                                                    )
                                                )
                                            }
                                        >
                                            {opt?.label ?? g.id} ✕
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
                                {(previewUserIds.length > 0 || pendingGroups.length > 0) && (
                                    <Typography level="body-xs" sx={{ opacity: 0.75 }}>
                                        {previewIsExact
                                            ? fmt(t.notes.teamNotes.memberCount, {
                                                  count: previewUserIds.length,
                                              })
                                            : t.notes.teamNotes.memberCountApprox}
                                    </Typography>
                                )}
                            </Box>
                            <Button
                                loading={saving}
                                disabled={
                                    saving ||
                                    (pendingUserIds.length === 0 && pendingGroups.length === 0)
                                }
                                onClick={() => void submit()}
                            >
                                {t.notes.sharing.invite}
                            </Button>
                        </Box>
                    </>
                )}

                {/* Cross-team sharing, under the roster because it is the
                    same question about a different unit: the list above is
                    people, this is whole organizations. Only a PRIVATE
                    folder can be lent out — public means "every host member
                    is an editor" plus a team-wide search sentinel, which
                    would make the folder's ACL mean two things at once — so
                    the offer control is withheld rather than shown and
                    refused. Renders nothing at all for an unshared folder. */}
                {folder && (
                    <ObjectSharesSection
                        borderColor="var(--joy-palette-divider)"
                        hostTeamId={folder.hostTeamId ?? myself.teamId}
                        labelColor="var(--joy-palette-text-tertiary)"
                        myUserId={myself.userId}
                        objectId={String(folder.folderId)}
                        objectType="note_folder"
                        socket={socket}
                        valueColor="var(--joy-palette-text-primary)"
                        canOffer={
                            canManageTeam && folder.visibility === "private" && !isExternalFolder
                        }
                    />
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
