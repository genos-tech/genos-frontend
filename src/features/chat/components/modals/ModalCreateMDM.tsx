import React, { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { Alert, Box, Button, Checkbox, Chip, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { SearchField } from "../../../../components/ui/fields/SearchField";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { ownTeamOnly } from "../../../../utils/teamRoster";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { createMDMChatGroup } from "../../services/createMDMChatGroup";

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
            // `ownTeamOnly`: see ModalCreateGM — the roster names people
            // from other teams, but only a share can let them in.
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
        <ModalFrame
            description={t.chat.modals.createMDM.description}
            icon={<PersonAddIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="md"
            title={t.chat.modals.createMDM.title}
            zIndex={10000}
            actions={
                <>
                    <Button color="neutral" variant="plain" onClick={() => setOpen(false)}>
                        {t.chat.modals.createMDM.cancel}
                    </Button>
                    <Button
                        disabled={selectedMembers.length < 2 || isLoading}
                        loading={isLoading}
                        onClick={handleCreateMDM}
                    >
                        {t.chat.modals.createMDM.startConversation}
                    </Button>
                </>
            }
            onClose={() => setOpen(false)}
        >
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

            {/* Search Input */}
            <SearchField
                placeholder={t.chat.modals.createMDM.searchPlaceholder}
                sx={{ mb: 2 }}
                value={searchQuery}
                onChange={setSearchQuery}
            />

            {/* Member List */}
            <Box
                sx={{
                    maxHeight: "250px",
                    overflowY: "auto",
                    mb: 2,
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
                            ? t.chat.modals.createMDM.noMembersMatchingSearch
                            : t.chat.modals.createMDM.noMembersAvailable}
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
                sx={{
                    mb: 2,
                    color: selectedMembers.length >= 2 ? g.accent.text : g.text.tertiary,
                }}
            >
                {fmt(t.chat.modals.createMDM.membersSelected, {
                    count: selectedMembers.length,
                })}
                {selectedMembers.length < 2 && t.chat.modals.createMDM.minRequiredSuffix}
            </Typography>

            {/* Error Alert */}
            {errorMessage && (
                <Alert color="danger" sx={{ mb: 2 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
