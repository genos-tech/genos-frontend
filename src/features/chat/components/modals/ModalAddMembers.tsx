import React, { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
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
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { addMembersToChat } from "../../services/addMembersToChat";
import { popTeamMembers } from "../../services/popTeamMembers";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

type Props = {
    socket: Socket | null;
    myself: UserProps;
    chat: AllChatProps;
    open: boolean;
    setOpen: (value: boolean) => void;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    setMyself: (value: UserProps) => void;
};

export const ModalAddMembers: React.FC<Props> = ({
    socket,
    myself,
    chat,
    open,
    setOpen,
    useCM,
    useTEM,
    useUISM,
    setMyself,
}) => {
    const { accessToken } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<UserProps[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());
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

            // Determine existing members based on chat type
            const existingIds = new Set<string>();
            existingIds.add(myself.userId); // Always exclude myself

            if (chat.chatType === 1 && chat.dmPartnerUser) {
                existingIds.add(chat.dmPartnerUser.userId);
            } else if (chat.chatType === 4 && chat.mdmMembers) {
                chat.mdmMembers.forEach((m) => existingIds.add(m.userId));
            }

            setExistingMemberIds(existingIds);
        }
    }, [open, myself, useTEM.teamMembers, chat]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setSelectedMembers([]);
            setErrorMessage(null);
        }
    }, [open]);

    // Filter out existing members from the list
    const filteredMembers = teamMembers.filter((member) => {
        // Exclude existing members
        if (existingMemberIds.has(member.userId)) {
            return false;
        }

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

    const handleAddMembers = async () => {
        if (selectedMembers.length === 0) {
            setErrorMessage("Please select at least 1 member to add.");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const memberIds = selectedMembers.map((m) => m.userId);
            await addMembersToChat(
                accessToken || "",
                myself,
                chat,
                memberIds,
                useCM,
                socket,
                (msg: string) => setErrorMessage(msg),
                setOpen,
                selectedMembers
            );
        } catch (error) {
            console.error("Failed to add members:", error);
            setErrorMessage("Failed to add members. Please try again.");
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
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.1)",
                    minWidth: "420px",
                    maxWidth: "500px",
                    maxHeight: "80vh",
                    p: 3,
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
                                "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                        }}
                    >
                        <PersonAddIcon sx={{ color: "rgba(59, 130, 246, 0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        Talk with more members
                    </Typography>
                </Box>

                {/* Current chat info */}
                {chat.chatType === 1 && chat.dmPartnerUser && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 2,
                            p: 1.5,
                            borderRadius: "10px",
                            backgroundColor: "rgba(59, 130, 246, 0.1)",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                        }}
                    >
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                            useCM={useCM}
                            isYou={myself.userId === chat.dmPartnerUser.userId}
                            myself={myself}
                            setMyself={setMyself}
                            showNameAndEmail={false}
                            socket={socket}
                            useUISM={useUISM}
                        />
                        <Box>
                            <Typography level="body-sm" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                                Current conversation with:
                            </Typography>
                            <Typography level="body-xs" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                                {chat.dmPartnerUser.userName}
                            </Typography>
                        </Box>
                    </Box>
                )}
                {chat.chatType === 4 && chat.mdmMembers && chat.mdmMembers.length > 0 && (
                    <Box
                        sx={{
                            mb: 2,
                            p: 1.5,
                            borderRadius: "10px",
                            backgroundColor: "rgba(59, 130, 246, 0.1)",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                        }}
                    >
                        <Typography
                            level="body-sm"
                            sx={{ color: "rgba(255, 255, 255, 0.9)", mb: 0.5 }}
                        >
                            Current members:
                        </Typography>
                        <Typography level="body-xs" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                            {chat.mdmMembers.map((m) => m.userName).join(", ")}
                        </Typography>
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
                            backgroundColor: "rgba(59, 130, 246, 0.1)",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                        }}
                    >
                        {selectedMembers.map((member) => (
                            <Chip
                                key={member.userId}
                                size="sm"
                                variant="soft"
                                color="primary"
                                endDecorator={
                                    <CloseRoundedIcon
                                        sx={{ fontSize: 14, cursor: "pointer" }}
                                        onClick={() => handleRemoveMember(member.userId)}
                                    />
                                }
                                sx={{
                                    "--Chip-gap": "4px",
                                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                                }}
                            >
                                {member.userName}
                            </Chip>
                        ))}
                    </Box>
                )}

                {/* Search Input */}
                <Input
                    placeholder="Search team members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    startDecorator={
                        <SearchRoundedIcon sx={{ color: "rgba(255, 255, 255, 0.4)" }} />
                    }
                    sx={{
                        mb: 2,
                        "--Input-focusedThickness": "1px",
                        "--Input-focusedHighlight": "rgba(59, 130, 246, 0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: "rgba(59, 130, 246, 0.3)",
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
                                ? "No members found matching your search."
                                : "No team members available to add."}
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
                                            ? "rgba(59, 130, 246, 0.1)"
                                            : "transparent",
                                        "&:hover": {
                                            backgroundColor: isSelected
                                                ? "rgba(59, 130, 246, 0.15)"
                                                : "rgba(255, 255, 255, 0.05)",
                                        },
                                        "&:last-child": {
                                            borderBottom: "none",
                                        },
                                    }}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        color="primary"
                                        variant="soft"
                                        sx={{ pointerEvents: "none" }}
                                    />
                                    <AvatarWithStatus
                                        avatarUser={useTEM.teamMemberProfiles[member.userId]}
                                        useCM={useCM}
                                        isYou={myself.userId === member.userId}
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
                            selectedMembers.length >= 1
                                ? "rgba(59, 130, 246, 0.8)"
                                : "rgba(255, 255, 255, 0.4)",
                    }}
                >
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""}{" "}
                    selected
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
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
                        Cancel
                    </Button>
                    <Button
                        disabled={selectedMembers.length === 0 || isLoading}
                        loading={isLoading}
                        onClick={handleAddMembers}
                        sx={{
                            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(59, 130, 246, 0.4)",
                            },
                            "&:disabled": {
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "rgba(255, 255, 255, 0.3)",
                            },
                        }}
                    >
                        Add Members
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
