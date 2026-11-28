// The members of a multi-person DM (MIP-2549): who is in it, add, remove, leave. The little
// sibling of `ModalGMProfile`: an MDM has no name, picture, roles or privacy to edit.

import { useEffect, useId, useMemo, useState } from "react";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { APP_MAIN_ID } from "../../../../components/layout/SkipToContent";
import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { ErrorState } from "../../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { SearchField } from "../../../../components/ui/fields/SearchField";
import { useMemberRemoval } from "../../../../components/ui/memberRoles/useMemberRemoval";
import { ModalLeaveConfirm } from "../../../../components/ui/misc/ModalLeaveConfirm";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { PROFILE_MODAL_Z_INDEX } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { ChannelKind, ChannelMember } from "../../../../types/channel";
import { AllChatProps } from "../../../../types/chat";
import { MEMBER_ROLE, MemberRole } from "../../../../utils/memberRoles";
import { withoutDeletedUsers } from "../../../../utils/teamRoster";
import { isMdmLimitError, MDM_MAX_MEMBERS } from "../../utils/mdmLimit";
import { ModalAddMembers } from "./ModalAddMembers";

type Props = {
    chat: AllChatProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    teamMemberProfiles: Record<string, UserProps>;
    useUISM: UIStateManagementState;
    hostZIndex?: number;
    onClose: () => void;
};

type Row = { userId: string; userName: string; userEmail: string };

type Roster = {
    ownerId: string | null;
    rows: Row[] | null;
    /** The chat was known and is gone: the viewer left, or was removed. */
    gone: boolean;
};

const rowsOf = (members: readonly ChannelMember[]): Row[] =>
    withoutDeletedUsers(
        members.map((m) => ({
            userId: m.userId,
            userName: m.user?.userName ?? "",
            userEmail: m.user?.userEmail ?? "",
        }))
    );

/** The channel's roster and creator, re-read from the store whenever it changes. */
const useMdmRoster = (chatId: string): Roster => {
    const [roster, setRoster] = useState<Roster>({ ownerId: null, rows: null, gone: false });
    useEffect(() => {
        let seen = false;
        let lastChannel: unknown;
        let lastMembers: unknown;
        const apply = () => {
            const snapshot = channelService.getSnapshot();
            const channel = snapshot.channels.get(chatId);
            const members = snapshot.membersByChannel.get(chatId);
            if (channel === lastChannel && members === lastMembers) return;
            lastChannel = channel;
            lastMembers = members;
            if (!channel) {
                setRoster({ ownerId: null, rows: null, gone: seen });
                return;
            }
            seen = true;
            setRoster({
                ownerId: channel.ownerId ?? null,
                rows: members ? rowsOf(members) : null,
                gone: false,
            });
        };
        apply();
        return channelService.subscribe(apply);
    }, [chatId]);
    return roster;
};

// The row (or header) whose chip opened this goes with the chat, and focus would drop to the
// page body. After the dialogs have handed focus back, put it at the start of the main content
// (the skip link's target).
const focusMainAfterLeave = () => {
    window.setTimeout(() => document.getElementById(APP_MAIN_ID)?.focus(), 0);
};

export const ModalMDMMembers = ({
    chat,
    myself,
    setMyself,
    socket,
    useCM,
    teamMemberProfiles,
    useUISM,
    hostZIndex: hostLayer,
    onClose,
}: Props) => {
    const { t } = useTranslation();
    const m = t.chat.modals.mdmMembers;
    const noteHostZIndex = useNoteModalHostZIndex();
    const hostZIndex = hostLayer ?? noteHostZIndex;
    // Genos-ui rule 1: a chat shown inside another modal passes its layer.
    const layer = hostZIndex != null ? hostZIndex + 2 : PROFILE_MODAL_Z_INDEX;
    const limitNoteId = useId();

    const { ownerId, rows, gone } = useMdmRoster(chat.chatId);
    const [query, setQuery] = useState("");
    const [openAdd, setOpenAdd] = useState(false);
    const [openLeave, setOpenLeave] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const load = () => {
        setLoadFailed(false);
        void channelService.refreshChannelMembers(chat.chatId).then((ok) => setLoadFailed(!ok));
    };
    // Ask the server every time, as the group profile does: the cached roster is filled once.
    useEffect(load, [chat.chatId]);

    useEffect(() => {
        if (gone) onClose();
    }, [gone, onClose]);

    // The creator removes people. When the creator's account is gone anyone may: the server
    // hands a creator who LEAVES on at once, so an owner who is not listed is a deleted one.
    const ownerListed = !!ownerId && !!rows?.some((r) => r.userId === ownerId);
    const iAmListed = !!rows?.some((r) => r.userId === myself.userId);
    const myRole: MemberRole =
        ownerId === myself.userId || (iAmListed && !ownerListed)
            ? MEMBER_ROLE.owner
            : MEMBER_ROLE.viewer;

    const removal = useMemberRemoval({
        kind: "chat",
        scopeName: m.scopeName,
        ownerUserId: ownerId,
        myRole,
        myUserId: myself.userId,
        zIndex: layer + 2,
        remove: async (userId) => {
            try {
                await channelService.removeMember(chat.chatId, ChannelKind.MDM, userId);
            } catch (error) {
                console.error("[ModalMDMMembers] remove failed:", error);
                throw new Error(t.common.memberRemoval.failed);
            }
        },
        onRemoved: () => {},
    });

    const total = rows?.length ?? 0;
    const full = total >= MDM_MAX_MEMBERS;

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return rows ?? [];
        return (rows ?? []).filter(
            (r) =>
                r.userName.toLowerCase().includes(needle) ||
                r.userEmail.toLowerCase().includes(needle)
        );
    }, [rows, query]);

    // Stable while the roster is: the picker re-reads its list whenever this changes.
    const memberIds = useMemo(() => rows?.map((r) => r.userId), [rows]);
    // The picker only names people from the team; it loads the list itself when empty.
    const useTEM = useMemo(() => ({ teamMembers: [], teamMemberProfiles }), [teamMemberProfiles]);

    const handleAdd = async (ids: string[]): Promise<boolean | string> => {
        try {
            const result = await channelService.addMembers(chat.chatId, ids);
            return !!result;
        } catch (error) {
            console.error("[ModalMDMMembers] add failed:", error);
            return isMdmLimitError(error) ? fmt(m.addFailedFull, { max: MDM_MAX_MEMBERS }) : false;
        }
    };

    const handleLeave = async () => {
        try {
            await channelService.removeMember(chat.chatId, ChannelKind.MDM, myself.userId);
        } catch (error) {
            console.error("[ModalMDMMembers] leave failed:", error);
            return false;
        }
        onClose();
        focusMainAfterLeave();
        return true;
    };

    return (
        <>
            <ModalFrame
                icon={<PeopleRoundedIcon sx={{ color: g.accent.text }} />}
                size="md"
                title={m.title}
                zIndex={layer}
                actions={
                    <Button
                        color="danger"
                        disabled={!iAmListed}
                        startDecorator={<LogoutRoundedIcon fontSize="small" />}
                        variant="outlined"
                        sx={{
                            borderRadius: g.radius.sm,
                            borderColor: g.danger.border,
                            color: g.danger.text,
                        }}
                        onClick={() => setOpenLeave(true)}
                    >
                        {m.leaveButton}
                    </Button>
                }
                description={
                    rows ? fmt(m.countOfMax, { count: total, max: MDM_MAX_MEMBERS }) : undefined
                }
                open
                onClose={onClose}
            >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
                    <SearchField
                        placeholder={m.searchPlaceholder}
                        sx={{ flex: 1, minWidth: 0 }}
                        value={query}
                        onChange={setQuery}
                    />
                    <Button
                        aria-describedby={full ? limitNoteId : undefined}
                        disabled={!rows || full}
                        startDecorator={<PersonAddAltRoundedIcon sx={{ fontSize: 16 }} />}
                        sx={{ flexShrink: 0 }}
                        variant="soft"
                        onClick={() => setOpenAdd(true)}
                    >
                        {m.addButton}
                    </Button>
                </Stack>

                {/* Said in words beside the button: a disabled button gets no hover, and a
                    phone has none. */}
                {full && (
                    <Typography
                        id={limitNoteId}
                        level="body-xs"
                        sx={{ mb: 1.5, color: g.text.secondary }}
                    >
                        {fmt(myRole === MEMBER_ROLE.owner ? m.atLimitCreator : m.atLimit, {
                            max: MDM_MAX_MEMBERS,
                        })}
                    </Typography>
                )}

                {!rows && loadFailed ? (
                    <ErrorState size="sm" title={m.loadError} onRetry={load} />
                ) : !rows ? (
                    <SkeletonRows count={3} avatar />
                ) : filtered.length === 0 ? (
                    <Typography
                        level="body-sm"
                        sx={{ py: 3, textAlign: "center", color: g.text.secondary }}
                    >
                        {fmt(t.chat.modals.gmProfile.noMembersFound, { query })}
                    </Typography>
                ) : (
                    <Box
                        aria-label={m.title}
                        component="ul"
                        sx={{
                            m: 0,
                            p: 0.5,
                            listStyle: "none",
                            borderRadius: g.radius.md,
                            border: `1px solid ${g.border.default}`,
                        }}
                    >
                        {filtered.map((row) => (
                            <Box
                                key={row.userId}
                                component="li"
                                data-testid={`mdm-member-${row.userId}`}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    px: 1,
                                    py: 0.75,
                                    minHeight: 44,
                                    borderRadius: g.radius.md,
                                    "&:hover": { backgroundColor: g.hover },
                                }}
                            >
                                <UserAvatar
                                    // A profile opened from a hosted modal would sit behind it.
                                    clickable={hostZIndex == null}
                                    fallbackName={row.userName}
                                    size={32}
                                    userId={row.userId}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography level="body-sm" sx={{ fontWeight: 500 }} noWrap>
                                        {row.userName}
                                        {row.userId === myself.userId && (
                                            <Typography sx={{ color: g.text.tertiary }}>
                                                {" "}
                                                ({m.you})
                                            </Typography>
                                        )}
                                    </Typography>
                                    <Typography
                                        level="body-xs"
                                        sx={{ color: g.text.tertiary }}
                                        noWrap
                                    >
                                        {row.userEmail}
                                    </Typography>
                                </Box>
                                {row.userId === ownerId && (
                                    <Chip color="neutral" size="sm" variant="soft">
                                        {m.creator}
                                    </Chip>
                                )}
                                {removal.button({ userId: row.userId, name: row.userName })}
                            </Box>
                        ))}
                    </Box>
                )}
            </ModalFrame>

            {removal.dialog}
            <ModalLeaveConfirm
                entityName={m.scopeName}
                hostZIndex={layer}
                open={openLeave}
                title={m.leaveTitle}
                description={
                    ownerId === myself.userId && total > 1
                        ? m.leaveDescriptionCreator
                        : m.leaveDescription
                }
                onCancel={() => setOpenLeave(false)}
                onConfirm={handleLeave}
            />
            <ModalAddMembers
                chat={chat}
                excludeUserIds={memberIds}
                heading={m.addHeading}
                myself={myself}
                open={openAdd}
                setMyself={setMyself}
                setOpen={setOpenAdd}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                zIndex={layer + 1}
                onAdd={handleAdd}
            />
        </>
    );
};
