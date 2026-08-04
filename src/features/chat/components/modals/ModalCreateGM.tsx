import React, { useEffect, useMemo, useState } from "react";
import { keyframes } from "@emotion/react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Checkbox,
    Chip,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { useTeamConnections } from "../../../admin/components/team/useTeamConnections";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { createChatGroup } from "../../services/createChatGroup";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

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
    const { mode, systemMode } = useColorScheme();
    // The modal surface is a fixed dark gradient in BOTH color schemes, so
    // Joy's default light-mode input text (a near-black) renders dark-on-dark
    // and is unreadable. Force a light text + caret + placeholder color when
    // the effective scheme is light; dark mode already uses light text, so
    // we leave it untouched.
    const isLightMode = (mode === "system" ? systemMode : mode) === "light";
    const lightInputTextSx = isLightMode
        ? {
              color: "rgba(255, 255, 255, 0.9)",
              "& input": {
                  color: "rgba(255, 255, 255, 0.9)",
                  caretColor: "rgba(255, 255, 255, 0.9)",
              },
              "& input::placeholder": {
                  color: "rgba(255, 255, 255, 0.5)",
                  opacity: 1,
              },
          }
        : {};

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
            if (useTEM.teamMembers.length > 0) {
                setTeamMembers(useTEM.teamMembers.filter((m) => m.userId !== myself.userId));
            } else {
                popTeamMembers(myself).then((members) => {
                    setTeamMembers(members.filter((m) => m.userId !== myself.userId));
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
            await createChatGroup(
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
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10000,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={() => setOpen(false)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(var(--gp-brand-700-rgb), 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--gp-brand-700-rgb), 0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "420px" },
                    maxWidth: { xs: "100vw", md: "500px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "85vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                }}
            >
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 40,
                            height: 40,
                            borderRadius: "10px",
                            background:
                                "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brand-700-rgb), 0.2) 100%)",
                            border: "1px solid rgba(var(--gp-brand-700-rgb), 0.3)",
                        }}
                    >
                        <GroupAddIcon
                            sx={{ color: "rgba(var(--gp-brand-700-rgb), 0.9)", fontSize: 22 }}
                        />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-brandalt-200) 0%, var(--gp-brandalt-300) 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        {t.chat.modals.createGM.title}
                    </Typography>
                </Box>

                {/* Group Name Input */}
                <Input
                    placeholder={t.chat.modals.createGM.groupNamePlaceholder}
                    value={chatName}
                    sx={{
                        mb: 2,
                        "--Input-focusedThickness": "1px",
                        "--Input-focusedHighlight": "rgba(var(--gp-brand-700-rgb), 0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: "rgba(var(--gp-brand-700-rgb), 0.3)",
                        },
                        ...lightInputTextSx,
                    }}
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
                        borderRadius: "10px",
                        backgroundColor:
                            isPrivate || isExternal
                                ? "rgba(var(--gp-brand-500-rgb), 0.1)"
                                : "rgba(34, 197, 94, 0.1)",
                        border: `1px solid ${isPrivate || isExternal ? "rgba(var(--gp-brand-500-rgb), 0.2)" : "rgba(34, 197, 94, 0.2)"}`,
                        cursor: isExternal ? "not-allowed" : "pointer",
                        opacity: isExternal ? 0.75 : 1,
                        transition: "all 0.2s ease",
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
                        variant="soft"
                        onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    {isPrivate || isExternal ? (
                        <LockOutlinedIcon
                            sx={{ color: "rgba(var(--gp-brand-500-rgb), 0.8)", fontSize: 18 }}
                        />
                    ) : (
                        <PublicIcon sx={{ color: "rgba(34, 197, 94, 0.8)", fontSize: 18 }} />
                    )}
                    <Typography
                        level="body-sm"
                        sx={{
                            color:
                                isPrivate || isExternal
                                    ? "rgba(var(--gp-brand-500-rgb), 0.9)"
                                    : "rgba(34, 197, 94, 0.9)",
                        }}
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
                            borderRadius: "10px",
                            backgroundColor: isExternal
                                ? "rgba(var(--gp-brand-700-rgb), 0.12)"
                                : "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${
                                isExternal
                                    ? "rgba(var(--gp-brand-700-rgb), 0.25)"
                                    : "rgba(255, 255, 255, 0.08)"
                            }`,
                            transition: "all 0.2s ease",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                cursor: "pointer",
                            }}
                            onClick={() => setIsExternal(!isExternal)}
                        >
                            <Checkbox
                                checked={isExternal}
                                color="primary"
                                sx={{ pointerEvents: "none" }}
                                variant="soft"
                            />
                            <PublicIcon
                                sx={{ color: "rgba(var(--gp-brand-700-rgb), 0.9)", fontSize: 18 }}
                            />
                            <Typography
                                level="body-sm"
                                sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 500 }}
                            >
                                {t.chat.modals.createGM.externalChat}
                            </Typography>
                        </Box>
                        <Typography
                            level="body-xs"
                            sx={{ mt: 0.75, ml: 0.5, color: "rgba(255, 255, 255, 0.5)" }}
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
                                            onClick={() =>
                                                handleToggleGuestTeam(connection.teamId)
                                            }
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
                            borderRadius: "10px",
                            backgroundColor: "rgba(var(--gp-brand-700-rgb), 0.1)",
                            border: "1px solid rgba(var(--gp-brand-700-rgb), 0.2)",
                        }}
                    >
                        {selectedMembers.map((member) => (
                            <Chip
                                key={member.userId}
                                color="primary"
                                size="sm"
                                variant="soft"
                                endDecorator={
                                    <CloseRoundedIcon
                                        sx={{ fontSize: 14, cursor: "pointer" }}
                                        onClick={() => handleRemoveMember(member.userId)}
                                    />
                                }
                                sx={{
                                    "--Chip-gap": "4px",
                                    backgroundColor: "rgba(var(--gp-brand-700-rgb), 0.2)",
                                }}
                            >
                                {member.userName}
                            </Chip>
                        ))}
                    </Box>
                )}

                {/* Member Search */}
                <Input
                    placeholder={t.chat.modals.createGM.searchPlaceholder}
                    value={searchQuery}
                    startDecorator={
                        <SearchRoundedIcon sx={{ color: "rgba(255, 255, 255, 0.4)" }} />
                    }
                    sx={{
                        mb: 1,
                        "--Input-focusedThickness": "1px",
                        "--Input-focusedHighlight": "rgba(var(--gp-brand-700-rgb), 0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: "rgba(var(--gp-brand-700-rgb), 0.3)",
                        },
                        ...lightInputTextSx,
                    }}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Member List */}
                <Box
                    sx={{
                        maxHeight: "200px",
                        overflowY: "auto",
                        mb: 1,
                        borderRadius: "10px",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                >
                    {filteredMembers.length === 0 ? (
                        <Typography
                            level="body-sm"
                            sx={{
                                p: 3,
                                textAlign: "center",
                                color: "rgba(255, 255, 255, 0.4)",
                            }}
                        >
                            {searchQuery
                                ? t.chat.modals.createGM.noMembersMatchingSearch
                                : t.chat.modals.createGM.noMembersAvailable}
                        </Typography>
                    ) : (
                        filteredMembers.map((member) => {
                            const isSelected = selectedMembers.some(
                                (m) => m.userId === member.userId
                            );
                            return (
                                <Box
                                    key={member.userId}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        p: 1.5,
                                        cursor: "pointer",
                                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                                        transition: "all 0.15s ease",
                                        backgroundColor: isSelected
                                            ? "rgba(var(--gp-brand-700-rgb), 0.1)"
                                            : "transparent",
                                        "&:hover": {
                                            backgroundColor: isSelected
                                                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : "rgba(255, 255, 255, 0.05)",
                                        },
                                        "&:last-child": {
                                            borderBottom: "none",
                                        },
                                    }}
                                    onClick={() => handleToggleMember(member)}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        color="primary"
                                        sx={{ pointerEvents: "none" }}
                                        variant="soft"
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
                                                color: "rgba(255, 255, 255, 0.9)",
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
                                                color: "rgba(255, 255, 255, 0.4)",
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
                    sx={{
                        mb: 2,
                        color:
                            selectedMembers.length > 0
                                ? "rgba(var(--gp-brand-700-rgb), 0.8)"
                                : "rgba(255, 255, 255, 0.4)",
                    }}
                >
                    {fmt(t.chat.modals.createGM.membersSelected, {
                        count: selectedMembers.length,
                    })}
                </Typography>

                {/* Error Alert */}
                {CreateCGErrorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(var(--gp-tint-danger-rgb), 0.1)",
                            border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.3)",
                        }}
                    >
                        {CreateCGErrorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                    <Button
                        variant="plain"
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 2.5,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                        onClick={() => setOpen(false)}
                    >
                        {t.chat.modals.createGM.cancel}
                    </Button>
                    <Button
                        disabled={!chatName.trim() || isLoading}
                        loading={isLoading}
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(var(--gp-brand-700-rgb), 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(var(--gp-brand-700-rgb), 0.4)",
                            },
                            "&:disabled": {
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "rgba(255, 255, 255, 0.3)",
                            },
                        }}
                        onClick={handleCreateGroup}
                    >
                        {t.chat.modals.createGM.createGroup}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
