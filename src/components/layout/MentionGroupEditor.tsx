import { useMemo, useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {
    Box,
    Divider,
    IconButton,
    Input,
    List,
    ListItem,
    ListItemButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { MentionGroup } from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";
import { AvatarWithStatus } from "../ui/avatars/avatarWithStatus";

type Props = {
    groupId: number;
    useTEM: TeamManagementState | undefined;
    // Required by `AvatarWithStatus`'s backwards-compat prop surface.
    // Threaded through from the call site (SettingsModal / App root).
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    // Called after the group is successfully deleted so the host
    // (panel / modal) can clear its selection / close itself.
    onDeleted?: () => void;
};

// Single-group editor: name + description + members. Extracted from
// `MentionGroupsPanel` so the same UI can be embedded inside the
// settings panel (next to the group list) AND inside the focused
// `MentionGroupModal` opened by clicking an @group chip.
export const MentionGroupEditor = ({
    groupId,
    useTEM,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
    onDeleted,
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const { mentionGroups, updateGroup, deleteGroup, addMembers, removeMember } =
        useMentionGroupsContext();

    const [editingName, setEditingName] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState<string | null>(null);
    const [memberPickerQuery, setMemberPickerQuery] = useState("");

    const group: MentionGroup | undefined = useMemo(
        () => mentionGroups.find((g) => g.groupId === groupId),
        [mentionGroups, groupId]
    );

    const teamMembers: UserProps[] = useTEM?.teamMembers ?? [];
    const teamMemberProfiles = useTEM?.teamMemberProfiles ?? {};

    const candidateMembers = useMemo(() => {
        if (!group) return [];
        const existing = new Set(group.memberUserIds);
        const q = memberPickerQuery.trim().toLowerCase();
        return teamMembers.filter((u) => {
            if (existing.has(u.userId)) return false;
            if (!q) return true;
            return (
                (u.userName || "").toLowerCase().includes(q) ||
                (u.userEmail || "").toLowerCase().includes(q)
            );
        });
    }, [group, teamMembers, memberPickerQuery]);

    const memberRows = useMemo(() => {
        if (!group) return [];
        return group.memberUserIds.map((uid) => ({
            userId: uid,
            user: teamMemberProfiles[uid] ?? teamMembers.find((u) => u.userId === uid),
        }));
    }, [group, teamMembers, teamMemberProfiles]);

    if (!group) {
        return (
            <Typography level="body-md" sx={{ opacity: 0.7 }}>
                Group not found.
            </Typography>
        );
    }

    const handleRename = async () => {
        if (editingName == null) return;
        const trimmed = editingName.trim();
        if (!trimmed || trimmed === group.groupName) {
            setEditingName(null);
            return;
        }
        await updateGroup(group.groupId, { groupName: trimmed });
        setEditingName(null);
    };

    const handleDescriptionSave = async () => {
        if (editingDescription == null) return;
        if (editingDescription === group.description) {
            setEditingDescription(null);
            return;
        }
        await updateGroup(group.groupId, { description: editingDescription });
        setEditingDescription(null);
    };

    const handleDelete = async () => {
        const ok = window.confirm(`Delete @${group.groupName}? This cannot be undone.`);
        if (!ok) return;
        await deleteGroup(group.groupId);
        onDeleted?.();
    };

    return (
        <Stack spacing={1.5}>
            {/* Name + delete */}
            <Stack direction="row" alignItems="center" spacing={1}>
                {editingName != null ? (
                    <Input
                        autoFocus
                        size="md"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void handleRename();
                            if (e.key === "Escape") setEditingName(null);
                        }}
                        onBlur={() => void handleRename()}
                        sx={{ flex: 1 }}
                    />
                ) : (
                    <Typography
                        level="title-lg"
                        sx={{ flex: 1, cursor: "pointer" }}
                        onClick={() => setEditingName(group.groupName)}
                    >
                        @{group.groupName}
                    </Typography>
                )}
                <Tooltip title="Delete group" size="sm" variant="outlined">
                    <IconButton
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={() => void handleDelete()}
                    >
                        <DeleteOutlineRoundedIcon />
                    </IconButton>
                </Tooltip>
            </Stack>

            {/* Description */}
            {editingDescription != null ? (
                <Input
                    autoFocus
                    size="md"
                    placeholder="Description (optional)"
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") void handleDescriptionSave();
                        if (e.key === "Escape") setEditingDescription(null);
                    }}
                    onBlur={() => void handleDescriptionSave()}
                />
            ) : (
                <Typography
                    level="body-md"
                    sx={{
                        opacity: 0.75,
                        cursor: "pointer",
                        fontStyle: group.description ? "normal" : "italic",
                    }}
                    onClick={() => setEditingDescription(group.description || "")}
                >
                    {group.description || "Add a description…"}
                </Typography>
            )}

            <Divider />

            {/* Members */}
            <Stack direction="row" alignItems="center" spacing={1}>
                <PersonRoundedIcon sx={{ fontSize: 18, opacity: 0.7 }} />
                <Typography level="title-md">Members ({group.memberCount})</Typography>
            </Stack>
            {memberRows.length === 0 ? (
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                    No members yet. Add some below.
                </Typography>
            ) : (
                <List sx={{ "--ListItem-paddingY": "6px" }}>
                    {memberRows.map((row) => (
                        <ListItem key={row.userId} sx={{ display: "flex", alignItems: "center" }}>
                            <Box sx={{ mr: 1.25, display: "inline-flex" }}>
                                <AvatarWithStatus
                                    avatarSize={32}
                                    avatarUser={row.user}
                                    isYou={row.userId === myself.userId}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useCM={useCM}
                                    useUISM={useUISM}
                                    showPulseDot={true}
                                />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography level="body-md" sx={{ fontWeight: 500 }} noWrap>
                                    {row.user?.userName || row.userId}
                                </Typography>
                                <Typography level="body-sm" sx={{ opacity: 0.65 }} noWrap>
                                    {row.user?.userEmail || ""}
                                </Typography>
                            </Box>
                            <Tooltip title="Remove member" size="sm" variant="outlined">
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="neutral"
                                    onClick={() => void removeMember(group.groupId, row.userId)}
                                >
                                    <CloseRoundedIcon />
                                </IconButton>
                            </Tooltip>
                        </ListItem>
                    ))}
                </List>
            )}

            <Divider />

            {/* Add member picker */}
            <Stack direction="row" alignItems="center" spacing={1}>
                <PersonAddAltRoundedIcon sx={{ fontSize: 18, opacity: 0.7 }} />
                <Typography level="title-md">Add members</Typography>
            </Stack>
            <Input
                size="md"
                placeholder="Search team members…"
                value={memberPickerQuery}
                onChange={(e) => setMemberPickerQuery(e.target.value)}
            />
            <List
                sx={{
                    "--ListItem-paddingY": "6px",
                    maxHeight: 240,
                    overflowY: "auto",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    borderRadius: "md",
                }}
            >
                {candidateMembers.length === 0 && (
                    <ListItem>
                        <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                            {memberPickerQuery
                                ? "No matching team members."
                                : "Everyone is already a member."}
                        </Typography>
                    </ListItem>
                )}
                {candidateMembers.map((u) => (
                    <ListItem key={u.userId} sx={{ p: 0 }}>
                        <ListItemButton
                            sx={{ px: 1.5, py: 0.75 }}
                            onClick={() => void addMembers(group.groupId, [u.userId])}
                        >
                            <Box sx={{ mr: 1.25, display: "inline-flex" }}>
                                <AvatarWithStatus
                                    avatarSize={32}
                                    avatarUser={u}
                                    isYou={u.userId === myself.userId}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useCM={useCM}
                                    useUISM={useUISM}
                                    showPulseDot={true}
                                />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography level="body-md" sx={{ fontWeight: 500 }} noWrap>
                                    {u.userName}
                                </Typography>
                                <Typography level="body-sm" sx={{ opacity: 0.65 }} noWrap>
                                    {u.userEmail}
                                </Typography>
                            </Box>
                            <CheckRoundedIcon sx={{ fontSize: 18, color: "primary.500" }} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Stack>
    );
};
