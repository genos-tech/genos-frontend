import { useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import {
    Box,
    Button,
    Chip,
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
import { Socket } from "socket.io-client";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { MentionGroup } from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";
import { MentionGroupEditor } from "./MentionGroupEditor";

type Props = {
    useTEM: TeamManagementState | undefined;
    // Threaded through to `MentionGroupEditor` for `AvatarWithStatus`.
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};

// Two-pane management UI for team-scoped @group mentions. Left: list of
// groups + "+ New group" button. Right: the shared `MentionGroupEditor`
// scoped to the selected group. The editor is the same component the
// click-an-@group-chip modal opens, so behaviour stays consistent
// across both surfaces.
export const MentionGroupsPanel = ({
    useTEM,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const { mentionGroups, createGroup } = useMentionGroupsContext();

    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");

    const selectedGroup: MentionGroup | undefined = useMemo(
        () => mentionGroups.find((g) => g.groupId === selectedGroupId),
        [mentionGroups, selectedGroupId]
    );

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

                {/* Right pane — single-group editor shared with the
                    click-an-@group-chip modal. */}
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
                        <MentionGroupEditor
                            groupId={selectedGroup.groupId}
                            useTEM={useTEM}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useUISM={useUISM}
                            onDeleted={() => setSelectedGroupId(null)}
                        />
                    )}
                </Box>
            </Stack>
        </Sheet>
    );
};
