import React, { useEffect, useMemo, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Alert, Box, Button, Checkbox, Chip, Input, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { ownTeamOnly } from "../../../../utils/teamRoster";
import { useTeamConnections } from "../../../admin/components/team/useTeamConnections";
import { relayCrossTeamRequest } from "../../../admin/services/crossTeamNotice";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { createChatGroup } from "../../services/createChatGroup";

type Props = {
    socket: Socket | null;
    myself: UserProps;
    open: boolean;
    setOpen: (value: boolean) => void;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    setMyself: (value: UserProps) => void;
};

export const ModalCreateGM: React.FC<Props> = ({
    socket,
    myself,
    open,
    setOpen,
    useCM,
    useTEM,
    useUISM,
    setMyself,
}) => {
    const { t } = useTranslation();
    const [isPrivate, setIsPrivate] = useState(false);
    const [CreateCGErrorMessage, setCreateCGErrorMessage] = useState<string | null>(null);
    const [chatName, setGroupName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<UserProps[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // Cross-team options. The whole block is hidden unless this team is
    // actually connected to someone: an "invite another organization"
    // control that can only ever be empty is worse than absent, and the
    // connection is set up in team settings, not here.
    const [isExternal, setIsExternal] = useState(false);
    const [guestTeamIds, setGuestTeamIds] = useState<string[]>([]);
    const { active: connectedTeams } = useTeamConnections(myself.teamId);

    // Load team members when the modal opens. Mirrors ModalCreateMDM: use
    // the live `useTEM.teamMembers` when it's populated, otherwise fall
    // back to a direct `popTeamMembers` fetch. Without this fallback the
    // selectable list is empty whenever `useTEM.teamMembers` hasn't loaded
    // yet — so the GM would be created with NO members (the invited users
    // never get auto-joined), the exact bug this fixes.
    useEffect(() => {
        if (open && myself.userId) {
            // `ownTeamOnly`: the other teams' people in the roster are
            // reachable through a share, not addable to a new chat. Offering
            // them here creates a group the server then refuses to admit
            // them to. Sharing the chat afterwards is the way.
            if (useTEM.teamMembers.length > 0) {
                setTeamMembers(
                    ownTeamOnly(useTEM.teamMembers).filter((m) => m.userId !== myself.userId)
                );
            } else {
                popTeamMembers(myself).then((members) => {
                    setTeamMembers(ownTeamOnly(members).filter((m) => m.userId !== myself.userId));
                });
            }
        }
    }, [open, myself, useTEM.teamMembers]);

    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setSelectedMembers([]);
            setCreateCGErrorMessage(null);
            setIsExternal(false);
            setGuestTeamIds([]);
        }
    }, [open]);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return teamMembers;
        const query = searchQuery.toLowerCase();
        return teamMembers.filter(
            (m) =>
                m.userName.toLowerCase().includes(query) ||
                m.userEmail.toLowerCase().includes(query)
        );
    }, [teamMembers, searchQuery]);

    const handleToggleMember = (member: UserProps) => {
        setSelectedMembers((prev) => {
            const isSelected = prev.some((m) => m.userId === member.userId);
            return isSelected ? prev.filter((m) => m.userId !== member.userId) : [...prev, member];
        });
    };

    const handleRemoveMember = (memberId: string) => {
        setSelectedMembers((prev) => prev.filter((m) => m.userId !== memberId));
    };

    const handleToggleGuestTeam = (teamId: string) => {
        setGuestTeamIds((prev) =>
            prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
        );
    };

    const handleCreateGroup = async () => {
        if (!chatName.trim() || isLoading) return;
        setIsLoading(true);
        setCreateCGErrorMessage(null);
        try {
            const memberIds = selectedMembers.map((m) => m.userId);
            const channel = await createChatGroup(
                myself,
                chatName,
                useCM,
                setCreateCGErrorMessage,
                setOpen,
                setGroupName,
                // An external chat is always private. Sending the toggle's
                // value would let the UI imply a choice the server refuses.
                isExternal ? true : isPrivate,
                memberIds,
                isExternal ? { guestTeamIds } : undefined
            );
            // Put the invitation in each guest team owner's open inbox.
            // Keyed by the CHANNEL because the offers are created inside
            // the create call and their grant ids never come back here —
            // and there can be several, one per invited team.
            if (channel && isExternal && guestTeamIds.length > 0) {
                relayCrossTeamRequest(socket, {
                    objectId: channel.id,
                    objectType: "channel",
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalFrame
            icon={<GroupAddIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="md"
            title={t.chat.modals.createGM.title}
            zIndex={10000}
            actions={
                <>
                    <Button color="neutral" variant="plain" onClick={() => setOpen(false)}>
                        {t.chat.modals.createGM.cancel}
                    </Button>
                    <Button
                        disabled={!chatName.trim() || isLoading}
                        loading={isLoading}
                        onClick={handleCreateGroup}
                    >
                        {t.chat.modals.createGM.createGroup}
                    </Button>
                </>
            }
            onClose={() => setOpen(false)}
        >
            {/* Group Name Input */}
            <Input
                placeholder={t.chat.modals.createGM.groupNamePlaceholder}
                sx={{ mb: 2 }}
                value={chatName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && chatName.trim()) {
                        handleCreateGroup();
                    }
                }}
            />

            {/* Private/Public Toggle. Locked on for an external chat:
                    a public one would be self-joinable by the whole host
                    team, which no guest team agreed to. */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.5,
                    mb: 2,
                    borderRadius: g.radius.md,
                    backgroundColor: isPrivate || isExternal ? g.accent.subtle : g.success.subtle,
                    border: `1px solid ${isPrivate || isExternal ? g.accent.border : g.success.border}`,
                    cursor: isExternal ? "not-allowed" : "pointer",
                    opacity: isExternal ? 0.75 : 1,
                }}
                onClick={() => {
                    if (!isExternal) setIsPrivate(!isPrivate);
                }}
            >
                <Checkbox
                    checked={isPrivate || isExternal}
                    color="neutral"
                    disabled={isExternal}
                    sx={{ pointerEvents: "none" }}
                    variant="outlined"
                    onChange={(e) => setIsPrivate(e.target.checked)}
                />
                {isPrivate || isExternal ? (
                    <LockOutlinedIcon sx={{ color: g.accent.text, fontSize: 18 }} />
                ) : (
                    <PublicIcon sx={{ color: g.success.text, fontSize: 18 }} />
                )}
                <Typography
                    level="body-sm"
                    sx={{ color: isPrivate || isExternal ? g.accent.text : g.success.text }}
                >
                    {isPrivate || isExternal
                        ? t.chat.modals.createGM.privateGroup
                        : t.chat.modals.createGM.publicGroup}
                </Typography>
            </Box>

            {connectedTeams.length > 0 && (
                <Box
                    sx={{
                        mb: 2,
                        p: 1.5,
                        borderRadius: g.radius.md,
                        backgroundColor: isExternal ? g.accent.subtle : g.bg.subtle,
                        border: `1px solid ${isExternal ? g.accent.border : g.border.default}`,
                    }}
                >
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer" }}
                        onClick={() => setIsExternal(!isExternal)}
                    >
                        <Checkbox
                            checked={isExternal}
                            color="primary"
                            sx={{ pointerEvents: "none" }}
                            variant="outlined"
                        />
                        <PublicIcon sx={{ color: g.accent.text, fontSize: 18 }} />
                        <Typography
                            level="body-sm"
                            sx={{ color: g.text.primary, fontWeight: 500 }}
                        >
                            {t.chat.modals.createGM.externalChat}
                        </Typography>
                    </Box>
                    <Typography
                        level="body-xs"
                        sx={{ mt: 0.75, ml: 0.5, color: g.text.secondary }}
                    >
                        {t.chat.modals.createGM.externalChatExplainer}
                    </Typography>

                    {isExternal && (
                        <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                            {connectedTeams.map((connection) => {
                                const selected = guestTeamIds.includes(connection.teamId);
                                return (
                                    <Chip
                                        key={connection.teamId}
                                        color={selected ? "primary" : "neutral"}
                                        size="sm"
                                        variant={selected ? "solid" : "outlined"}
                                        onClick={() => handleToggleGuestTeam(connection.teamId)}
                                    >
                                        {connection.teamName}
                                    </Chip>
                                );
                            })}
                        </Box>
                    )}
                </Box>
            )}

            {/* Selected Members Chips */}
            {selectedMembers.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        mb: 2,
                        p: 1.5,
                        borderRadius: g.radius.md,
                        backgroundColor: g.accent.subtle,
                        border: `1px solid ${g.accent.border}`,
                    }}
                >
                    {selectedMembers.map((member) => (
                        <Chip
                            key={member.userId}
                            color="primary"
                            size="sm"
                            sx={{ "--Chip-gap": "4px", backgroundColor: g.accent.subtle }}
                            variant="soft"
                            endDecorator={
                                <CloseRoundedIcon
                                    sx={{ fontSize: 14, cursor: "pointer" }}
                                    onClick={() => handleRemoveMember(member.userId)}
                                />
                            }
                        >
                            {member.userName}
                        </Chip>
                    ))}
                </Box>
            )}

            {/* Member Search */}
            <Input
                placeholder={t.chat.modals.createGM.searchPlaceholder}
                startDecorator={<SearchRoundedIcon sx={{ color: g.text.tertiary }} />}
                sx={{ mb: 1 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Member List */}
            <Box
                sx={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    mb: 1,
                    borderRadius: g.radius.md,
                    backgroundColor: g.bg.subtle,
                    border: `1px solid ${g.border.subtle}`,
                }}
            >
                {filteredMembers.length === 0 ? (
                    <Typography
                        level="body-sm"
                        sx={{ p: 3, textAlign: "center", color: g.text.tertiary }}
                    >
                        {searchQuery
                            ? t.chat.modals.createGM.noMembersMatchingSearch
                            : t.chat.modals.createGM.noMembersAvailable}
                    </Typography>
                ) : (
                    filteredMembers.map((member) => {
                        const isSelected = selectedMembers.some((m) => m.userId === member.userId);
                        return (
                            <Box
                                key={member.userId}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    p: 1.5,
                                    cursor: "pointer",
                                    borderBottom: `1px solid ${g.border.subtle}`,
                                    backgroundColor: isSelected ? g.accent.subtle : "transparent",
                                    "&:hover": {
                                        backgroundColor: isSelected ? g.accent.subtle : g.hover,
                                    },
                                    "&:last-child": { borderBottom: "none" },
                                }}
                                onClick={() => handleToggleMember(member)}
                            >
                                <Checkbox
                                    checked={isSelected}
                                    color="primary"
                                    sx={{ pointerEvents: "none" }}
                                    variant="outlined"
                                />
                                <AvatarWithStatus
                                    avatarUser={member}
                                    isYou={false}
                                    myself={myself}
                                    setMyself={setMyself}
                                    showNameAndEmail={false}
                                    socket={socket}
                                    useCM={useCM}
                                    useUISM={useUISM}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            color: g.text.primary,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {member.userName}
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
                                        {member.userEmail}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Box>

            {/* Selected Count */}
            <Typography
                level="body-xs"
                sx={{ mb: 2, color: selectedMembers.length > 0 ? g.accent.text : g.text.tertiary }}
            >
                {fmt(t.chat.modals.createGM.membersSelected, {
                    count: selectedMembers.length,
                })}
            </Typography>

            {/* Error Alert */}
            {CreateCGErrorMessage && (
                <Alert color="danger" sx={{ mb: 2 }}>
                    {CreateCGErrorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
