import { useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {
    Avatar,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Input,
    List,
    ListItem,
    ListItemButton,
    Sheet,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { MentionGroup } from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type Props = {
    useTEM: TeamManagementState | undefined;
};

// Two-pane management UI for team-scoped @group mentions. Left: list of
// groups + "+ New group" button. Right: members of the selected group,
// inline add/remove via a member picker, plus delete-group action.
// Keeps the modal's overall layout calm by reusing Joy primitives the
// rest of SettingsModal already uses.
export const MentionGroupsPanel = ({ useTEM }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const { mentionGroups, createGroup, updateGroup, deleteGroup, addMembers, removeMember } =
        useMentionGroupsContext();

    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [editingName, setEditingName] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState<string | null>(null);
    const [memberPickerQuery, setMemberPickerQuery] = useState("");

    const selectedGroup: MentionGroup | undefined = useMemo(
        () => mentionGroups.find((g) => g.groupId === selectedGroupId),
        [mentionGroups, selectedGroupId]
    );

    const teamMembers: UserProps[] = useTEM?.teamMembers ?? [];
    const teamMemberProfiles = useTEM?.teamMemberProfiles ?? {};

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        const created = await createGroup(trimmed, newDescription.trim());
        if (created) {
            setSelectedGroupId(created.groupId);
            setCreating(false);
            setNewName("");
            setNewDescription("");
        }
    };

    const handleRename = async () => {
        if (!selectedGroup || editingName == null) return;
        const trimmed = editingName.trim();
        if (!trimmed || trimmed === selectedGroup.groupName) {
            setEditingName(null);
            return;
        }
        await updateGroup(selectedGroup.groupId, { groupName: trimmed });
        setEditingName(null);
    };

    const handleDescriptionSave = async () => {
        if (!selectedGroup || editingDescription == null) return;
        if (editingDescription === selectedGroup.description) {
            setEditingDescription(null);
            return;
        }
        await updateGroup(selectedGroup.groupId, { description: editingDescription });
        setEditingDescription(null);
    };

    const handleDelete = async () => {
        if (!selectedGroup) return;
        const ok = window.confirm(`Delete @${selectedGroup.groupName}? This cannot be undone.`);
        if (!ok) return;
        await deleteGroup(selectedGroup.groupId);
        setSelectedGroupId(null);
    };

    // Members eligible to be added: team members not already in the group.
    const candidateMembers = useMemo(() => {
        if (!selectedGroup) return [];
        const existing = new Set(selectedGroup.memberUserIds);
        const q = memberPickerQuery.trim().toLowerCase();
        return teamMembers.filter((u) => {
            if (existing.has(u.userId)) return false;
            if (!q) return true;
            return (
                (u.userName || "").toLowerCase().includes(q) ||
                (u.userEmail || "").toLowerCase().includes(q)
            );
        });
    }, [selectedGroup, teamMembers, memberPickerQuery]);

    const memberRows = useMemo(() => {
        if (!selectedGroup) return [];
        return selectedGroup.memberUserIds.map((uid) => ({
            userId: uid,
            user: teamMemberProfiles[uid] ?? teamMembers.find((u) => u.userId === uid),
        }));
    }, [selectedGroup, teamMembers, teamMemberProfiles]);

    return (
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2 }}>
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <GroupRoundedIcon />
                <Typography level="title-md">Mention groups</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 2 }}>
                Team-scoped @groups. Anyone in your team can mention a group in chat, task
                comments, or task bodies; every member of the group is notified.
            </Typography>

            <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={2}
                sx={{ alignItems: "stretch" }}
            >
                {/* Left pane — group list. Side-by-side layout kicks in
                    at `lg` (matches the SettingsModal width breakpoint);
                    below that the two panes stack vertically so they
                    don't truncate the modal. */}
                <Box sx={{ flex: 1, minWidth: 0, width: { xs: "100%", lg: 260 } }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography level="title-sm" sx={{ flex: 1 }}>
                            Groups
                        </Typography>
                        <Tooltip title="New group" size="sm" variant="outlined">
                            <IconButton
                                size="sm"
                                variant="soft"
                                onClick={() => {
                                    setCreating(true);
                                    setNewName("");
                                    setNewDescription("");
                                }}
                            >
                                <AddRoundedIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    {creating && (
                        <Sheet
                            variant="soft"
                            sx={{ p: 1, borderRadius: "md", mb: 1, background: "neutral.softBg" }}
                        >
                            <Stack spacing={0.75}>
                                <Input
                                    autoFocus
                                    size="sm"
                                    placeholder="group-name (lowercase)"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") void handleCreate();
                                        if (e.key === "Escape") setCreating(false);
                                    }}
                                />
                                <Input
                                    size="sm"
                                    placeholder="Description (optional)"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                />
                                <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        color="neutral"
                                        onClick={() => setCreating(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="solid"
                                        disabled={!newName.trim()}
                                        onClick={() => void handleCreate()}
                                    >
                                        Create
                                    </Button>
                                </Stack>
                            </Stack>
                        </Sheet>
                    )}

                    <List
                        sx={{
                            "--ListItem-paddingY": "6px",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                            borderRadius: "md",
                            overflow: "hidden",
                            maxHeight: 320,
                            overflowY: "auto",
                        }}
                    >
                        {mentionGroups.length === 0 && !creating && (
                            <ListItem>
                                <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                                    No groups yet. Click + to create one.
                                </Typography>
                            </ListItem>
                        )}
                        {mentionGroups.map((g) => (
                            <ListItem key={g.groupId} sx={{ p: 0 }}>
                                <ListItemButton
                                    selected={g.groupId === selectedGroupId}
                                    onClick={() => setSelectedGroupId(g.groupId)}
                                    sx={{ px: 1.25, py: 0.75 }}
                                >
                                    <GroupRoundedIcon
                                        sx={{ fontSize: 16, color: "#16a34a", mr: 0.75 }}
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            level="body-sm"
                                            sx={{ fontWeight: 600 }}
                                            noWrap
                                        >
                                            @{g.groupName}
                                        </Typography>
                                    </Box>
                                    <Chip size="sm" variant="soft" color="success">
                                        {g.memberCount}
                                    </Chip>
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Box>

                {/* Right pane — member editor for the selected group */}
                <Box sx={{ flex: 2, minWidth: 0 }}>
                    {!selectedGroup ? (
                        <Box
                            sx={{
                                p: 3,
                                textAlign: "center",
                                color: "text.tertiary",
                                border: "1px dashed",
                                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                                borderRadius: "md",
                            }}
                        >
                            <Typography level="body-sm">
                                Select a group on the left to manage its members.
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={1.5}>
                            {/* Name + delete */}
                            <Stack direction="row" alignItems="center" spacing={1}>
                                {editingName != null ? (
                                    <Input
                                        autoFocus
                                        size="sm"
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
                                        level="title-md"
                                        sx={{ flex: 1, cursor: "pointer" }}
                                        onClick={() => setEditingName(selectedGroup.groupName)}
                                    >
                                        @{selectedGroup.groupName}
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
                                    size="sm"
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
                                    level="body-sm"
                                    sx={{
                                        opacity: 0.75,
                                        cursor: "pointer",
                                        fontStyle: selectedGroup.description ? "normal" : "italic",
                                    }}
                                    onClick={() =>
                                        setEditingDescription(selectedGroup.description || "")
                                    }
                                >
                                    {selectedGroup.description || "Add a description…"}
                                </Typography>
                            )}

                            <Divider />

                            {/* Members */}
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <PersonRoundedIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                                <Typography level="title-sm">
                                    Members ({selectedGroup.memberCount})
                                </Typography>
                            </Stack>
                            {memberRows.length === 0 ? (
                                <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                                    No members yet. Add some below.
                                </Typography>
                            ) : (
                                <List sx={{ "--ListItem-paddingY": "4px" }}>
                                    {memberRows.map((row) => (
                                        <ListItem
                                            key={row.userId}
                                            sx={{ display: "flex", alignItems: "center" }}
                                        >
                                            <Avatar
                                                size="sm"
                                                src={
                                                    row.user?.avatarImgPath
                                                        ? `${media_url}/${row.user.avatarImgPath}`
                                                        : undefined
                                                }
                                                sx={{ width: 24, height: 24, mr: 1 }}
                                            >
                                                {(row.user?.userName?.[0] || "?").toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography level="body-sm" noWrap>
                                                    {row.user?.userName || row.userId}
                                                </Typography>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ opacity: 0.6 }}
                                                    noWrap
                                                >
                                                    {row.user?.userEmail || ""}
                                                </Typography>
                                            </Box>
                                            <Tooltip
                                                title="Remove member"
                                                size="sm"
                                                variant="outlined"
                                            >
                                                <IconButton
                                                    size="sm"
                                                    variant="plain"
                                                    color="neutral"
                                                    onClick={() =>
                                                        void removeMember(
                                                            selectedGroup.groupId,
                                                            row.userId
                                                        )
                                                    }
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
                                <PersonAddAltRoundedIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                                <Typography level="title-sm">Add members</Typography>
                            </Stack>
                            <Input
                                size="sm"
                                placeholder="Search team members…"
                                value={memberPickerQuery}
                                onChange={(e) => setMemberPickerQuery(e.target.value)}
                            />
                            <List
                                sx={{
                                    "--ListItem-paddingY": "4px",
                                    maxHeight: 220,
                                    overflowY: "auto",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.06)",
                                    borderRadius: "md",
                                }}
                            >
                                {candidateMembers.length === 0 && (
                                    <ListItem>
                                        <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                                            {memberPickerQuery
                                                ? "No matching team members."
                                                : "Everyone is already a member."}
                                        </Typography>
                                    </ListItem>
                                )}
                                {candidateMembers.map((u) => (
                                    <ListItem key={u.userId} sx={{ p: 0 }}>
                                        <ListItemButton
                                            sx={{ px: 1.25, py: 0.5 }}
                                            onClick={() =>
                                                void addMembers(selectedGroup.groupId, [u.userId])
                                            }
                                        >
                                            <Avatar
                                                size="sm"
                                                src={
                                                    u.avatarImgPath
                                                        ? `${media_url}/${u.avatarImgPath}`
                                                        : undefined
                                                }
                                                sx={{ width: 24, height: 24, mr: 1 }}
                                            >
                                                {(u.userName?.[0] || "?").toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography level="body-sm" noWrap>
                                                    {u.userName}
                                                </Typography>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ opacity: 0.6 }}
                                                    noWrap
                                                >
                                                    {u.userEmail}
                                                </Typography>
                                            </Box>
                                            <CheckRoundedIcon
                                                sx={{ fontSize: 16, color: "primary.500" }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        </Stack>
                    )}
                </Box>
            </Stack>
        </Sheet>
    );
};
