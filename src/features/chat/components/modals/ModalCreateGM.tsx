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
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UserProps } from "../../../../types/admin";
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
};

export const ModalCreateGM: React.FC<Props> = ({
    socket,
    myself,
    open,
    setOpen,
    useCM,
    useTEM,
}) => {
    const { accessToken } = useAuth();

    const [isPrivate, setIsPrivate] = useState(true);
    const [CreateCGErrorMessage, setCreateCGErrorMessage] = useState<string | null>(null);
    const [chatName, setGroupName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<UserProps[]>([]);

    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setSelectedMembers([]);
            setCreateCGErrorMessage(null);
        }
    }, [open]);

    const availableMembers = useMemo(() => {
        return useTEM.teamMembers.filter((m) => m.userId !== myself.userId);
    }, [useTEM.teamMembers, myself.userId]);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return availableMembers;
        const query = searchQuery.toLowerCase();
        return availableMembers.filter(
            (m) =>
                m.userName.toLowerCase().includes(query) ||
                m.userEmail.toLowerCase().includes(query)
        );
    }, [availableMembers, searchQuery]);

    const handleToggleMember = (member: UserProps) => {
        setSelectedMembers((prev) => {
            const isSelected = prev.some((m) => m.userId === member.userId);
            return isSelected
                ? prev.filter((m) => m.userId !== member.userId)
                : [...prev, member];
        });
    };

    const handleRemoveMember = (memberId: string) => {
        setSelectedMembers((prev) => prev.filter((m) => m.userId !== memberId));
    };

    const handleCreateGroup = () => {
        if (chatName.trim()) {
            const memberIds = selectedMembers.map((m) => m.userId);
            createChatGroup(
                myself,
                chatName,
                useCM,
                socket,
                setCreateCGErrorMessage,
                setOpen,
                setGroupName,
                accessToken ? accessToken : "",
                isPrivate,
                memberIds
            );
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
                    maxHeight: "85vh",
                    p: 3,
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
                                "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                        }}
                    >
                        <GroupAddIcon sx={{ color: "rgba(59, 130, 246, 0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        Create New Group
                    </Typography>
                </Box>

                {/* Group Name Input */}
                <Input
                    placeholder="Enter group name..."
                    value={chatName}
                    onChange={(e) => setGroupName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && chatName.trim()) {
                            handleCreateGroup();
                        }
                    }}
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

                {/* Private/Public Toggle */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.5,
                        mb: 2,
                        borderRadius: "10px",
                        backgroundColor: isPrivate
                            ? "rgba(168, 85, 247, 0.1)"
                            : "rgba(34, 197, 94, 0.1)",
                        border: `1px solid ${isPrivate ? "rgba(168, 85, 247, 0.2)" : "rgba(34, 197, 94, 0.2)"}`,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                    }}
                    onClick={() => setIsPrivate(!isPrivate)}
                >
                    <Checkbox
                        checked={isPrivate}
                        color="neutral"
                        variant="soft"
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        sx={{ pointerEvents: "none" }}
                    />
                    {isPrivate ? (
                        <LockOutlinedIcon
                            sx={{ color: "rgba(168, 85, 247, 0.8)", fontSize: 18 }}
                        />
                    ) : (
                        <PublicIcon sx={{ color: "rgba(34, 197, 94, 0.8)", fontSize: 18 }} />
                    )}
                    <Typography
                        level="body-sm"
                        sx={{
                            color: isPrivate
                                ? "rgba(168, 85, 247, 0.9)"
                                : "rgba(34, 197, 94, 0.9)",
                        }}
                    >
                        {isPrivate ? "Private Group" : "Public Group"}
                    </Typography>
                </Box>

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

                {/* Member Search */}
                <Input
                    placeholder="Search team members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    startDecorator={
                        <SearchRoundedIcon sx={{ color: "rgba(255, 255, 255, 0.4)" }} />
                    }
                    sx={{
                        mb: 1,
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
                                ? "No members found matching your search."
                                : "No team members available."}
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
                                    <Avatar
                                        size="sm"
                                        src={member.avatarImgPath}
                                        sx={{
                                            border: isSelected
                                                ? "2px solid rgba(59, 130, 246, 0.5)"
                                                : "2px solid transparent",
                                        }}
                                    >
                                        {member.userName?.[0]?.toUpperCase()}
                                    </Avatar>
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
                                ? "rgba(59, 130, 246, 0.8)"
                                : "rgba(255, 255, 255, 0.4)",
                    }}
                >
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""}{" "}
                    selected (optional)
                </Typography>

                {/* Error Alert */}
                {CreateCGErrorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                    >
                        {CreateCGErrorMessage}
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
                        disabled={!chatName.trim()}
                        onClick={handleCreateGroup}
                        sx={{
                            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
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
                        Create Group
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
