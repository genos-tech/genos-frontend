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
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { addMembersToChat } from "../../services/addMembersToChat";

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
    /** Extra user ids to hide from the picker, on top of the ones this
     *  modal derives itself. Needed for GM / project, whose rosters this
     *  component can't see — `AllChatProps` only carries `dmPartnerUser`
     *  (DM) and `mdmMembers` (MDM). Callers pass the roster they already
     *  loaded for their member list. */
    excludeUserIds?: string[];
    /** Overrides the default `addMembersToChat` dispatch. Return true on
     *  success (the modal closes). Lets the profile modals own their own
     *  add+notify while reusing this picker — `addMembersToChat` speaks
     *  DM→MDM conversion and MDM adds, which is not what they need. */
    onAdd?: (memberIds: string[]) => Promise<boolean>;
    /** Title override — "Add members to <this project>" reads better than
     *  the DM-flavoured default when hosted in a profile modal. */
    heading?: string;
    /** Stacking layer. Defaults to the page-level 10000 this modal has
     *  always used (chat list / pane header open it over the page). A
     *  modal-hosted opener MUST pass its own z + 1: the profile modals sit
     *  at PROFILE_MODAL_Z_INDEX, so the default would render this picker
     *  behind the very modal that opened it. */
    zIndex?: number;
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
    excludeUserIds,
    onAdd,
    heading,
    zIndex = 10000,
}) => {
    const { t } = useTranslation();
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
            // GM / project rosters aren't on `AllChatProps`, so their
            // callers hand us the list they already loaded.
            excludeUserIds?.forEach((id) => existingIds.add(id));

            setExistingMemberIds(existingIds);
        }
    }, [open, myself, useTEM.teamMembers, chat, excludeUserIds]);

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
            setErrorMessage(t.chat.modals.addMembers.errorMinimumMembers);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const memberIds = selectedMembers.map((m) => m.userId);
            if (onAdd) {
                const ok = await onAdd(memberIds);
                if (ok) {
                    setOpen(false);
                } else {
                    setErrorMessage(t.chat.modals.addMembers.errorAdd);
                }
                return;
            }
            await addMembersToChat(
                myself,
                chat,
                memberIds,
                useCM,
                (msg: string) => setErrorMessage(msg),
                setOpen
            );
        } catch (error) {
            console.error("Failed to add members:", error);
            setErrorMessage(t.chat.modals.addMembers.errorAdd);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex,
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
                                "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(124,58,237,0.2) 100%)",
                            border: "1px solid rgba(124,58,237,0.3)",
                        }}
                    >
                        <PersonAddIcon sx={{ color: "rgba(124,58,237,0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        {heading ?? t.chat.modals.addMembers.title}
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
                            backgroundColor: "rgba(124,58,237,0.1)",
                            border: "1px solid rgba(124,58,237,0.2)",
                        }}
                    >
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                            isYou={myself.userId === chat.dmPartnerUser.userId}
                            myself={myself}
                            setMyself={setMyself}
                            showNameAndEmail={false}
                            socket={socket}
                            useCM={useCM}
                            useUISM={useUISM}
                        />
                        <Box>
                            <Typography level="body-sm" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                                {t.chat.modals.addMembers.currentConversationWith}
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
                            backgroundColor: "rgba(124,58,237,0.1)",
                            border: "1px solid rgba(124,58,237,0.2)",
                        }}
                    >
                        <Typography
                            level="body-sm"
                            sx={{ color: "rgba(255, 255, 255, 0.9)", mb: 0.5 }}
                        >
                            {t.chat.modals.addMembers.currentMembers}
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
                            backgroundColor: "rgba(124,58,237,0.1)",
                            border: "1px solid rgba(124,58,237,0.2)",
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
                    placeholder={t.chat.modals.addMembers.searchPlaceholder}
                    value={searchQuery}
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
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                                ? t.chat.modals.addMembers.noMembersMatchingSearch
                                : t.chat.modals.addMembers.noMembersAvailable}
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
                                    onClick={() => handleToggleMember(member)}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        color="primary"
                                        sx={{ pointerEvents: "none" }}
                                        variant="soft"
                                    />
                                    <AvatarWithStatus
                                        avatarUser={useTEM.teamMemberProfiles[member.userId]}
                                        isYou={myself.userId === member.userId}
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
                            selectedMembers.length >= 1
                                ? "rgba(124,58,237,0.8)"
                                : "rgba(255, 255, 255, 0.4)",
                    }}
                >
                    {fmt(t.chat.modals.addMembers.membersSelected, {
                        count: selectedMembers.length,
                    })}
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
                        {t.chat.modals.addMembers.cancel}
                    </Button>
                    <Button
                        disabled={selectedMembers.length === 0 || isLoading}
                        loading={isLoading}
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
                        onClick={handleAddMembers}
                    >
                        {t.chat.modals.addMembers.addMembers}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
