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
import { AllChatProps } from "../../../../types/chat";
import { ownTeamOnly } from "../../../../utils/teamRoster";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { addMembersToChat } from "../../services/addMembersToChat";

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
            // `ownTeamOnly`: the roster also carries the other teams'
            // people you already work with, and the server will not let you
            // add them here — access across teams comes from the share.
            if (useTEM.teamMembers.length > 0) {
                setTeamMembers(
                    ownTeamOnly(useTEM.teamMembers).filter((m) => m.userId !== myself.userId)
                );
            } else {
                popTeamMembers(myself).then((members) => {
                    setTeamMembers(ownTeamOnly(members).filter((m) => m.userId !== myself.userId));
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
        <ModalFrame
            icon={<PersonAddIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="md"
            title={heading ?? t.chat.modals.addMembers.title}
            zIndex={zIndex}
            actions={
                <>
                    <Button color="neutral" variant="plain" onClick={() => setOpen(false)}>
                        {t.chat.modals.addMembers.cancel}
                    </Button>
                    <Button
                        disabled={selectedMembers.length === 0 || isLoading}
                        loading={isLoading}
                        onClick={handleAddMembers}
                    >
                        {t.chat.modals.addMembers.addMembers}
                    </Button>
                </>
            }
            onClose={() => setOpen(false)}
        >
            {/* Current chat info */}
            {chat.chatType === 1 && chat.dmPartnerUser && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 2,
                        p: 1.5,
                        borderRadius: g.radius.md,
                        backgroundColor: g.accent.subtle,
                        border: `1px solid ${g.accent.border}`,
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
                        <Typography level="body-sm" sx={{ color: g.text.primary }}>
                            {t.chat.modals.addMembers.currentConversationWith}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: g.text.secondary }}>
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
                        borderRadius: g.radius.md,
                        backgroundColor: g.accent.subtle,
                        border: `1px solid ${g.accent.border}`,
                    }}
                >
                    <Typography level="body-sm" sx={{ color: g.text.primary, mb: 0.5 }}>
                        {t.chat.modals.addMembers.currentMembers}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
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
                            sx={{ "--Chip-gap": "4px" }}
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
                placeholder={t.chat.modals.addMembers.searchPlaceholder}
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
                            ? t.chat.modals.addMembers.noMembersMatchingSearch
                            : t.chat.modals.addMembers.noMembersAvailable}
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
                    color: selectedMembers.length >= 1 ? g.accent.text : g.text.tertiary,
                }}
            >
                {fmt(t.chat.modals.addMembers.membersSelected, {
                    count: selectedMembers.length,
                })}
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
