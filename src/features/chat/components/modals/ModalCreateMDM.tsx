import React, { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
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
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { createMDMChatGroup } from "../../services/createMDMChatGroup";

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

export const ModalCreateMDM: React.FC<Props> = ({
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
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<UserProps[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load team members when modal opens
    useEffect(() => {
        if (open && myself.userId) {
            // Use team members from useTEM if available, otherwise load them
            if (useTEM.teamMembers.length > 0) {
                setTeamMembers(useTEM.teamMembers.filter((m) => m.userId !== myself.userId));
            } else {
                popTeamMembers(myself).then((members) => {
                    setTeamMembers(members.filter((m) => m.userId !== myself.userId));
                });
            }
        }
    }, [open, myself, useTEM.teamMembers]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setSelectedMembers([]);
            setErrorMessage(null);
        }
    }, [open]);

    const filteredMembers = teamMembers.filter((member) => {
        const query = searchQuery.toLowerCase();
        return (
            member.userName.toLowerCase().includes(query) ||
            member.userEmail.toLowerCase().includes(query)
        );
    });

    const handleToggleMember = (member: UserProps) => {
        setSelectedMembers((prev) => {
            const isSelected = prev.some((m) => m.userId === member.userId);
            if (isSelected) {
                return prev.filter((m) => m.userId !== member.userId);
            } else {
                return [...prev, member];
            }
        });
    };

    const handleRemoveMember = (memberId: string) => {
        setSelectedMembers((prev) => prev.filter((m) => m.userId !== memberId));
    };

    const handleCreateMDM = async () => {
        if (selectedMembers.length < 2) {
            setErrorMessage(t.chat.modals.createMDM.errorMinimumMembers);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const memberIds = selectedMembers.map((m) => m.userId);
            await createMDMChatGroup(
                myself,
                memberIds,
                useCM,
                (msg: string) => setErrorMessage(msg),
                setOpen
            );
        } catch (error) {
            console.error("Failed to create MDM:", error);
            setErrorMessage(t.chat.modals.createMDM.errorCreate);
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
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={() => setOpen(false)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124,58,237,0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "420px" },
                    maxWidth: { xs: "100vw", md: "500px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "80vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                }}
            >
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 40,
                            height: 40,
                            borderRadius: "10px",
                            background:
                                "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(109,40,217,0.2) 100%)",
                            border: "1px solid rgba(124,58,237,0.3)",
                        }}
                    >
                        <PersonAddIcon sx={{ color: "rgba(124,58,237,0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        {t.chat.modals.createMDM.title}
                    </Typography>
                </Box>

                {/* Description */}
                <Typography level="body-sm" sx={{ mb: 2, color: "rgba(255, 255, 255, 0.6)" }}>
                    {t.chat.modals.createMDM.description}
                </Typography>

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
                            backgroundColor: "rgba(124,58,237,0.1)",
                            border: "1px solid rgba(124,58,237,0.2)",
                        }}
                    >
                        {selectedMembers.map((member) => (
                            <Chip
                                key={member.userId}
                                size="sm"
                                variant="soft"
                                color="success"
                                endDecorator={
                                    <CloseRoundedIcon
                                        sx={{ fontSize: 14, cursor: "pointer" }}
                                        onClick={() => handleRemoveMember(member.userId)}
                                    />
                                }
                                sx={{
                                    "--Chip-gap": "4px",
                                    backgroundColor: "rgba(124,58,237,0.2)",
                                }}
                            >
                                {member.userName}
                            </Chip>
                        ))}
                    </Box>
                )}

                {/* Search Input */}
                <Input
                    placeholder={t.chat.modals.createMDM.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    startDecorator={
                        <SearchRoundedIcon sx={{ color: "rgba(255, 255, 255, 0.4)" }} />
                    }
                    sx={{
                        mb: 2,
                        "--Input-focusedThickness": "1px",
                        "--Input-focusedHighlight": "rgba(124,58,237,0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: "rgba(124,58,237,0.3)",
                        },
                    }}
                />

                {/* Member List */}
                <Box
                    sx={{
                        maxHeight: "250px",
                        overflowY: "auto",
                        mb: 2,
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
                                ? t.chat.modals.createMDM.noMembersMatchingSearch
                                : t.chat.modals.createMDM.noMembersAvailable}
                        </Typography>
                    ) : (
                        filteredMembers.map((member) => {
                            const isSelected = selectedMembers.some(
                                (m) => m.userId === member.userId
                            );
                            return (
                                <Box
                                    key={member.userId}
                                    onClick={() => handleToggleMember(member)}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        p: 1.5,
                                        cursor: "pointer",
                                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                                        transition: "all 0.15s ease",
                                        backgroundColor: isSelected
                                            ? "rgba(124,58,237,0.1)"
                                            : "transparent",
                                        "&:hover": {
                                            backgroundColor: isSelected
                                                ? "rgba(124,58,237,0.15)"
                                                : "rgba(255, 255, 255, 0.05)",
                                        },
                                        "&:last-child": {
                                            borderBottom: "none",
                                        },
                                    }}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        color="success"
                                        variant="soft"
                                        sx={{ pointerEvents: "none" }}
                                    />
                                    <AvatarWithStatus
                                        avatarUser={member}
                                        useCM={useCM}
                                        isYou={false}
                                        myself={myself}
                                        setMyself={setMyself}
                                        showNameAndEmail={false}
                                        socket={socket}
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
                            selectedMembers.length >= 2
                                ? "rgba(124,58,237,0.8)"
                                : "rgba(255, 255, 255, 0.4)",
                    }}
                >
                    {fmt(t.chat.modals.createMDM.membersSelected, {
                        count: selectedMembers.length,
                    })}
                    {selectedMembers.length < 2 && t.chat.modals.createMDM.minRequiredSuffix}
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                    <Button
                        variant="plain"
                        onClick={() => setOpen(false)}
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 2.5,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                    >
                        {t.chat.modals.createMDM.cancel}
                    </Button>
                    <Button
                        disabled={selectedMembers.length < 2 || isLoading}
                        loading={isLoading}
                        onClick={handleCreateMDM}
                        sx={{
                            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(124,58,237,0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(124,58,237,0.4)",
                            },
                            "&:disabled": {
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "rgba(255, 255, 255, 0.3)",
                            },
                        }}
                    >
                        {t.chat.modals.createMDM.startConversation}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
